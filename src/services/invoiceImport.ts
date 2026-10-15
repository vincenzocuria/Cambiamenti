import { supabase } from '../lib/supabase'
import { school } from '../data/school'
import { parseFatturaPa, type ParsedInvoice } from '../lib/fatturaPa'
import { expandInvoiceFiles, invoiceDirection } from '../lib/invoiceFile'
import { matchInvoiceToCandidate } from '../lib/eipassInvoice'
import { fullName } from '../lib/format'
import type { EipassCandidate, InvoiceDirection } from '../types/db'
import { listEipassCandidates, updateEipassCandidate } from './eipass'

export interface InvoiceImportResult {
  added: number
  updated: number
  eipassLinked: number
  /** Righe da mostrare: scarti e abbinamenti EIPASS. */
  report: string[]
}

async function findExisting(direction: InvoiceDirection, fileName: string, p: ParsedInvoice, vat: string) {
  const { data: byFile, error: e1 } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('direction', direction)
    .eq('aruba_filename', fileName)
    .maybeSingle()
  if (e1) throw e1
  if (byFile) return byFile as { id: string; status: string }
  let query = supabase
    .from('invoices')
    .select('id, status')
    .eq('direction', direction)
    .eq('number', p.number)
    .eq('invoice_date', p.date)
  // Fornitori diversi possono usare lo stesso numero
  if (direction === 'in' && vat) query = query.eq('counterpart_vat', vat)
  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  return data as { id: string; status: string } | null
}

/**
 * Importa le fatture scaricate dal pannello Aruba (XML, .p7m o .zip): le aggiunge al registro
 * emesse/ricevute, completa quelle già presenti e abbina le emesse ai corsisti EIPASS.
 */
export async function importInvoiceFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<InvoiceImportResult> {
  const raw = await Promise.all(
    files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
  )
  const { invoices, skipped } = await expandInvoiceFiles(raw)
  const report = [...skipped]
  let added = 0
  let updated = 0
  let eipassLinked = 0
  let candidates: EipassCandidate[] | null = null

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

      const existing = await findExisting(direction, file.name, p, counterpart.vat)
      let invoiceId: string
      if (existing) {
        // Una fattura preparata nell'app e poi caricata su Aruba diventa «caricata»
        const status = existing.status === 'imported' ? 'imported' : 'sent'
        const { error } = await supabase.from('invoices').update({ ...fields, status }).eq('id', existing.id)
        if (error) throw error
        invoiceId = existing.id
        updated++
      } else {
        const { data, error } = await supabase
          .from('invoices')
          .insert({ ...fields, direction, status: 'imported' })
          .select('id')
          .single()
        if (error) throw error
        invoiceId = (data as { id: string }).id
        added++
      }

      if (direction === 'out') {
        candidates ??= await listEipassCandidates()
        const match = matchInvoiceToCandidate(
          {
            number: p.number,
            date: p.date,
            taxCode: (p.buyerTaxCode || p.buyerVat).toUpperCase(),
            total: p.total,
            fileName: file.name,
          },
          candidates,
        )
        if (match) {
          if (
            match.invoice_status !== 'fatturato' ||
            match.invoice_number !== p.number ||
            match.invoice_date !== p.date
          ) {
            const saved = await updateEipassCandidate(match.id, {
              invoice_status: 'fatturato',
              invoice_number: p.number,
              invoice_date: p.date,
            })
            candidates = candidates.map((c) => (c.id === saved.id ? saved : c))
            report.push(`Fattura n. ${p.number}: corsista EIPASS ${fullName(saved)} segnato come fatturato`)
          }
          const { error } = await supabase
            .from('invoices')
            .update({ eipass_candidate_id: match.id })
            .eq('id', invoiceId)
          if (error) throw error
          eipassLinked++
        }
      }
    } catch (err) {
      report.push(`${file.name}: ${err instanceof Error ? err.message : 'errore'}`)
    }
  }
  onProgress?.(invoices.length, invoices.length)
  return { added, updated, eipassLinked, report }
}
