import type { SupabaseClient } from '@supabase/supabase-js'
import { school } from '../data/school'
import { parseFatturaPa, type ParsedInvoice } from '../lib/fatturaPa'
import { expandInvoiceFiles, invoiceDirection } from '../lib/invoiceFile'
import { matchInvoiceToCandidate } from '../lib/eipassInvoice'
import { fullName } from '../lib/format'
import { customerFromParty, partyKey } from '../lib/customer'
import type { EipassCandidate, InvoiceDirection, InvoiceLine } from '../types/db'

export interface InvoiceImportResult {
  added: number
  updated: number
  /** Clienti e fornitori creati dai dati delle fatture. */
  partiesCreated: number
  /** Corsisti EIPASS creati dalle fatture di certificazioni. */
  eipassCreated: number
  eipassLinked: number
  /** Righe da mostrare: scarti e abbinamenti EIPASS. */
  report: string[]
}

async function findExisting(
  supabase: SupabaseClient,
  direction: InvoiceDirection,
  fileName: string,
  p: ParsedInvoice,
  vat: string,
) {
  const { data: byFile, error: e1 } = await supabase
    .from('invoices')
    .select('id, status, customer_id')
    .eq('direction', direction)
    .eq('aruba_filename', fileName)
    .maybeSingle()
  if (e1) throw e1
  if (byFile) return byFile as Existing
  let query = supabase
    .from('invoices')
    .select('id, status, customer_id')
    .eq('direction', direction)
    .eq('number', p.number)
    .eq('invoice_date', p.date)
  // Fornitori diversi possono usare lo stesso numero
  if (direction === 'in' && vat) query = query.eq('counterpart_vat', vat)
  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  return data as Existing | null
}

type Existing = { id: string; status: string; customer_id: string | null }

/**
 * Collega la fattura all'anagrafica della controparte (cliente per le emesse, fornitore per le
 * ricevute), creandola dai dati dell'XML se non c'è ancora. La cache evita doppioni nello stesso import.
 */
export class PartyResolver {
  private byKey: Map<string, string> | null = null
  created = 0
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async resolve(direction: InvoiceDirection, p: ParsedInvoice): Promise<string | null> {
    const input =
      direction === 'out'
        ? customerFromParty(p.buyer, { sdiCode: p.buyerSdiCode, pec: p.buyerPec })
        : customerFromParty(p.seller)
    const key = partyKey(input)
    if (!key) return null
    if (!this.byKey) {
      this.byKey = new Map()
      for (let from = 0; ; from += 1000) {
        const { data, error } = await this.supabase
          .from('customers')
          .select('id, vat_number, tax_code')
          .range(from, from + 999)
        if (error) throw error
        for (const c of (data ?? []) as { id: string; vat_number: string; tax_code: string }[]) {
          // Un'azienda si ritrova sia per partita IVA sia per codice fiscale
          for (const k of [partyKey(c), partyKey({ vat_number: '', tax_code: c.tax_code })]) {
            if (k && !this.byKey.has(k)) this.byKey.set(k, c.id)
          }
        }
        if (!data || data.length < 1000) break
      }
    }
    const known = this.byKey.get(key) ?? this.byKey.get(partyKey({ vat_number: '', tax_code: input.tax_code }))
    if (known) return known
    const { data, error } = await this.supabase.from('customers').insert(input).select('id').single()
    if (error) throw error
    const id = (data as { id: string }).id
    this.byKey.set(key, id)
    this.created++
    return id
  }
}

/** La fattura riguarda una certificazione EIPASS venduta a una persona? */
export function eipassLine(p: ParsedInvoice): InvoiceLine | null {
  if (p.buyer.companyName || !p.buyer.taxCode) return null
  return p.lines.find((l) => /eipass/i.test(l.description)) ?? null
}

const paymentFromCode: Record<string, string> = {
  MP01: 'contanti',
  MP02: 'assegno',
  MP05: 'bonifico',
  MP08: 'carta',
}

/**
 * Collega una fattura emessa al corsista EIPASS (per codice fiscale) e lo segna «fatturato»;
 * se il corsista non c'è ancora e la fattura è di una certificazione EIPASS, lo crea dai dati
 * della fattura.
 */
export class EipassLinker {
  private candidates: EipassCandidate[] | null = null
  created = 0
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async link(p: ParsedInvoice, invoiceId: string, report: string[]): Promise<boolean> {
    this.candidates ??= await listCandidates(this.supabase)
    const match = matchInvoiceToCandidate(
      {
        number: p.number,
        date: p.date,
        taxCode: (p.buyerTaxCode || p.buyerVat).toUpperCase(),
        total: p.total,
        fileName: '',
      },
      this.candidates,
    )
    let candidateId: string
    if (match) {
      candidateId = match.id
      if (match.invoice_status !== 'fatturato' || match.invoice_number !== p.number || match.invoice_date !== p.date) {
        const { error } = await this.supabase
          .from('eipass_candidates')
          .update({ invoice_status: 'fatturato', invoice_number: p.number, invoice_date: p.date })
          .eq('id', match.id)
        if (error) throw error
        const saved: EipassCandidate = { ...match, invoice_status: 'fatturato', invoice_number: p.number, invoice_date: p.date }
        this.candidates = this.candidates.map((c) => (c.id === saved.id ? saved : c))
        report.push(`Fattura n. ${p.number}: corsista EIPASS ${fullName(saved)} segnato come fatturato`)
      }
    } else {
      const line = eipassLine(p)
      if (!line) return false
      const person = customerFromParty(p.buyer)
      const { data, error } = await this.supabase
        .from('eipass_candidates')
        .insert({
          first_name: person.first_name,
          last_name: person.last_name,
          tax_code: person.tax_code,
          address: person.address,
          city: person.city,
          postal_code: person.postal_code,
          province: person.province,
          certification: line.description.trim().replace(/\s+/g, ' ').slice(0, 200),
          purchase_date: p.date || null,
          amount: p.total,
          vat_rate: line.vat_rate,
          payment_method: paymentFromCode[p.paymentCode] ?? '',
          invoice_status: 'fatturato',
          invoice_number: p.number,
          invoice_date: p.date || null,
          notes: `Creato dalla fattura n. ${p.number} importata da Aruba`,
        })
        .select('*')
        .single()
      if (error) throw error
      const saved = data as EipassCandidate
      this.candidates.push(saved)
      this.created++
      candidateId = saved.id
      report.push(`Fattura n. ${p.number}: creato il corsista EIPASS ${fullName(saved)} (fatturato)`)
    }
    const { error } = await this.supabase.from('invoices').update({ eipass_candidate_id: candidateId }).eq('id', invoiceId)
    if (error) throw error
    return true
  }
}

async function listCandidates(supabase: SupabaseClient): Promise<EipassCandidate[]> {
  const { data, error } = await supabase.from('eipass_candidates').select('*')
  if (error) throw error
  return (data as EipassCandidate[]).map((c) => ({
    ...c,
    amount: c.amount == null ? null : Number(c.amount),
    vat_rate: c.vat_rate == null ? 22 : Number(c.vat_rate),
  }))
}

/**
 * Importa le fatture scaricate dal pannello Aruba (XML, .p7m o .zip): le aggiunge al registro
 * emesse/ricevute, completa quelle già presenti e abbina le emesse ai corsisti EIPASS.
 * Riceve il client Supabase, così la usano sia l'app sia lo script Aruba sul PC.
 */
export async function importInvoiceBytes(
  supabase: SupabaseClient,
  raw: { name: string; bytes: Uint8Array }[],
  onProgress?: (done: number, total: number) => void,
): Promise<InvoiceImportResult> {
  const { invoices, skipped } = await expandInvoiceFiles(raw)
  const report = [...skipped]
  let added = 0
  let updated = 0
  let eipassLinked = 0
  const parties = new PartyResolver(supabase)
  const eipass = new EipassLinker(supabase)

  for (const [index, file] of invoices.entries()) {
    onProgress?.(index, invoices.length)
    try {
      const p = parseFatturaPa(file.xml)
      if (!p.number || !p.date) throw new Error('numero o data mancanti')
      const direction = invoiceDirection(p)
      if (!direction) {
        report.push(`${file.name}: non intestata né emessa da ${school.companyName}, saltata`)
        continue
      }
      const counterpart =
        direction === 'out'
          ? { name: p.buyerName, vat: p.buyerVat, tax: p.buyerTaxCode }
          : { name: p.sellerName, vat: p.sellerVat, tax: p.sellerTaxCode }
      const fields = {
        xml: file.xml,
        doc_type: p.docType || 'TD01',
        number: p.number,
        invoice_date: p.date,
        counterpart_name: counterpart.name,
        counterpart_vat: counterpart.vat,
        counterpart_tax_code: counterpart.tax,
        taxable: p.taxable,
        vat_amount: p.vat,
        stamp: p.stamp,
        total: p.total,
        causale: p.causale,
        payment_due: p.paymentDue || null,
        lines: p.lines,
        aruba_filename: file.name,
      }

      const existing = await findExisting(supabase, direction, file.name, p, counterpart.vat)
      const customerId = existing?.customer_id ?? (await parties.resolve(direction, p))
      let invoiceId: string
      if (existing) {
        // Una fattura preparata nell'app e poi caricata su Aruba diventa «caricata»
        const status = existing.status === 'imported' ? 'imported' : 'sent'
        const { error } = await supabase
          .from('invoices')
          .update({ ...fields, status, customer_id: customerId })
          .eq('id', existing.id)
        if (error) throw error
        invoiceId = existing.id
        updated++
      } else {
        const { data, error } = await supabase
          .from('invoices')
          .insert({ ...fields, direction, status: 'imported', customer_id: customerId })
          .select('id')
          .single()
        if (error) throw error
        invoiceId = (data as { id: string }).id
        added++
      }

      if (direction === 'out') {
        const linked = await eipass.link(p, invoiceId, report)
        if (linked) eipassLinked++
      }
    } catch (err) {
      report.push(`${file.name}: ${err instanceof Error ? err.message : 'errore'}`)
    }
  }
  onProgress?.(invoices.length, invoices.length)
  return { added, updated, partiesCreated: parties.created, eipassCreated: eipass.created, eipassLinked, report }
}

/**
 * Per le fatture già nel registro: crea e collega il cliente/fornitore che manca e, per le
 * emesse, il corsista EIPASS (lo collega se esiste, lo crea se la fattura è di una certificazione).
 */
export async function linkInvoiceParties(
  supabase: SupabaseClient,
  onProgress?: (done: number, total: number) => void,
): Promise<{ linked: number; partiesCreated: number; eipassCreated: number; eipassLinked: number; report: string[] }> {
  type Row = {
    id: string
    direction: InvoiceDirection
    number: string
    xml: string
    customer_id: string | null
    eipass_candidate_id: string | null
  }
  const rows: Row[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, direction, number, xml, customer_id, eipass_candidate_id')
      .or('customer_id.is.null,and(direction.eq.out,eipass_candidate_id.is.null)')
      .not('xml', 'is', null)
      .order('invoice_date', { ascending: true, nullsFirst: false })
      .order('id')
      .range(from, from + 499)
    if (error) throw error
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 500) break
  }
  const parties = new PartyResolver(supabase)
  const eipass = new EipassLinker(supabase)
  const report: string[] = []
  let linked = 0
  let eipassLinked = 0
  for (const [i, row] of rows.entries()) {
    onProgress?.(i, rows.length)
    try {
      const p = parseFatturaPa(row.xml)
      if (!row.customer_id) {
        const id = await parties.resolve(row.direction, p)
        if (id) {
          const { error } = await supabase.from('invoices').update({ customer_id: id }).eq('id', row.id)
          if (error) throw error
          linked++
        } else report.push(`Fattura n. ${row.number}: controparte senza partita IVA né codice fiscale`)
      }
      if (row.direction === 'out' && !row.eipass_candidate_id && (await eipass.link(p, row.id, report))) eipassLinked++
    } catch (err) {
      report.push(`Fattura n. ${row.number}: ${err instanceof Error ? err.message : 'errore'}`)
    }
  }
  onProgress?.(rows.length, rows.length)
  return { linked, partiesCreated: parties.created, eipassCreated: eipass.created, eipassLinked, report }
}
