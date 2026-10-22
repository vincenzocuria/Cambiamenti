import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import type { SupabaseClient } from '@supabase/supabase-js'
import { importInvoiceBytes } from '../../src/services/invoiceImportCore'
import { dataDir, supabaseAdmin } from './env'
import { ensureLoggedIn, openBrowser } from './browser'
import {
  OUT_INVALID_STATES,
  OUT_STATES,
  PanelApi,
  downloadInvoice,
  listInvoices,
  panelDate,
  uploadToDrafts,
  type Direction,
  type PanelInvoiceItem,
} from './panelApi'

interface KnownInvoice {
  id: string
  number: string
  invoice_date: string | null
  aruba_filename: string | null
  counterpart_name: string
  sdi_id: string
  sdi_status: string
  sdi_status_label: string
  eipass_candidate_id: string | null
  paid_at: string | null
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

async function knownInvoices(client: SupabaseClient, direction: Direction, year: number): Promise<KnownInvoice[]> {
  const rows: KnownInvoice[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('invoices')
      .select(
        'id, number, invoice_date, aruba_filename, counterpart_name, sdi_id, sdi_status, sdi_status_label, eipass_candidate_id, paid_at',
      )
      .eq('direction', direction)
      .gte('invoice_date', `${year}-01-01`)
      .lte('invoice_date', `${year}-12-31`)
      .range(from, from + 999)
    if (error) throw error
    rows.push(...((data ?? []) as KnownInvoice[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

/** La fattura del pannello è già nel registro di Cambiamenti? */
function findKnown(direction: Direction, item: PanelInvoiceItem, known: KnownInvoice[]): KnownInvoice | undefined {
  const date = panelDate(item.Data)
  const files = [item.FileName, item.SdiFileName].map(norm).filter(Boolean)
  return known.find((k) => {
    if (k.aruba_filename && files.some((f) => norm(k.aruba_filename).startsWith(f.replace(/p7m$/, '')))) return true
    if (k.number !== item.Numero || k.invoice_date !== date) return false
    // Fornitori diversi possono usare lo stesso numero nello stesso giorno
    return direction === 'out' || !item.Mittente || norm(k.counterpart_name) === norm(item.Mittente)
  })
}

async function openPanel(hidden: boolean) {
  const context = await openBrowser({ hidden })
  const page = context.pages()[0] ?? (await context.newPage())
  const api = new PanelApi(page)
  try {
    await ensureLoggedIn(page, hidden ? 1 : 5)
  } catch (err) {
    await context.close()
    if (hidden) throw new Error('Serve di nuovo il login (forse con OTP): lancia «npm run aruba -- accedi»')
    throw err
  }
  return { context, api }
}

/**
 * Scarica dal pannello le fatture emesse e ricevute dell'anno che mancano in Cambiamenti, le
 * importa e aggiorna lo stato SdI delle emesse.
 */
export async function syncFromAruba(opts: { years: number[]; hidden: boolean }): Promise<void> {
  const client = await supabaseAdmin()
  const { context, api } = await openPanel(opts.hidden)
  const log: string[] = []
  try {
    // Un solo browser per tutti gli anni: Edge non riapre subito lo stesso profilo
    for (const year of opts.years)
    for (const direction of ['out', 'in'] as Direction[]) {
      const label = direction === 'out' ? 'emesse' : 'ricevute'
      const items = await listInvoices(api, direction, year)
      const known = await knownInvoices(client, direction, year)
      const missing: PanelInvoiceItem[] = []
      let sdiUpdated = 0

      for (const item of items) {
        const state = direction === 'out' ? OUT_STATES[item.Stato ?? -1] : undefined
        const match = findKnown(direction, item, known)
        if (!match) {
          // Le emesse scartate, annullate o in errore non entrano nel registro
          if (direction === 'out' && OUT_INVALID_STATES.has(item.Stato ?? -1)) {
            log.push(`Emessa n. ${item.Numero}: ${state}, non importata`)
          } else missing.push(item)
          continue
        }
        // Fattura preparata in Cambiamenti e caricata su Aruba: manca ancora il file di Aruba
        if (!match.aruba_filename && !OUT_INVALID_STATES.has(item.Stato ?? -1)) missing.push(item)
        // Stato SdI aggiornato dal pannello (solo emesse)
        if (state && (match.sdi_status !== String(item.Stato) || match.sdi_status_label !== state)) {
          const { error } = await client
            .from('invoices')
            .update({ sdi_status: String(item.Stato), sdi_status_label: state, sdi_id: item.IdSdi || match.sdi_id })
            .eq('id', match.id)
          if (error) throw error
          sdiUpdated++
        }
      }

      console.log(`Fatture ${label} ${year}: ${items.length} su Aruba, ${missing.length} da scaricare`)
      const folder = path.join(dataDir, 'scaricate', String(year), label)
      fs.mkdirSync(folder, { recursive: true })
      const raw: { name: string; bytes: Uint8Array }[] = []
      for (const [i, item] of missing.entries()) {
        process.stdout.write(`\r  scarico ${i + 1}/${missing.length}`)
        try {
          const file = await downloadInvoice(api, direction, item.Id, year)
          fs.writeFileSync(path.join(folder, file.name.replace(/[\\/:*?"<>|]/g, '_')), file.bytes)
          raw.push(file)
        } catch (err) {
          log.push(`${label} n. ${item.Numero}: download non riuscito (${err instanceof Error ? err.message : err})`)
        }
      }
      if (missing.length) process.stdout.write('\n')

      if (raw.length) {
        const result = await importInvoiceBytes(client, raw)
        console.log(
          `  importate: ${result.added} nuove, ${result.updated} aggiornate, ${result.partiesCreated} clienti/fornitori creati, ${result.eipassCreated} corsisti EIPASS creati, ${result.eipassLinked} abbinate a corsisti EIPASS, ${result.coursesLinked} collegate ai corsi`,
        )
        log.push(...result.report)
      }
      // Stato SdI delle emesse appena importate
      if (direction === 'out' && missing.length) {
        const fresh = await knownInvoices(client, direction, year)
        for (const item of missing) {
          const match = findKnown(direction, item, fresh)
          const state = OUT_STATES[item.Stato ?? -1]
          if (!match || !state) continue
          await client
            .from('invoices')
            .update({ sdi_status: String(item.Stato), sdi_status_label: state, sdi_id: item.IdSdi || match.sdi_id })
            .eq('id', match.id)
        }
      }
      if (sdiUpdated) console.log(`  stato SdI aggiornato su ${sdiUpdated} fatture`)

      // Incassi segnati su Aruba: data d'incasso sulla fattura e pagamento sul corsista EIPASS collegato
      if (direction === 'out') {
        const paid = items.filter((i) => i.StatoPagInc === 1 && i.DataPagInc)
        if (paid.length) {
          const fresh = await knownInvoices(client, direction, year)
          let paidUpdated = 0
          let invoicesPaid = 0
          for (const item of paid) {
            const match = findKnown(direction, item, fresh)
            if (!match) continue
            const paidAt = panelDate(item.DataPagInc ?? '')
            if (paidAt && match.paid_at !== paidAt) {
              const { error } = await client.from('invoices').update({ paid_at: paidAt }).eq('id', match.id)
              if (error) throw error
              invoicesPaid++
            }
            if (!match.eipass_candidate_id) continue
            const { data, error } = await client
              .from('eipass_candidates')
              .update({ payment_date: panelDate(item.DataPagInc ?? '') })
              .eq('id', match.eipass_candidate_id)
              .is('payment_date', null)
              .select('id')
            if (error) throw error
            paidUpdated += data?.length ?? 0
          }
          if (invoicesPaid) console.log(`  incasso segnato su ${invoicesPaid} fatture`)
          if (paidUpdated) console.log(`  pagamento segnato su ${paidUpdated} corsisti EIPASS`)
        }
      }
    }
  } finally {
    await context.close()
  }
  for (const line of log) console.log(`  - ${line}`)
  fs.writeFileSync(
    path.join(dataDir, 'ultima-sincronizzazione.json'),
    JSON.stringify({ at: new Date().toISOString(), years: opts.years, log }, null, 2),
  )
  console.log('Sincronizzazione finita.')
}

/** Nome file come lo vuole lo SdI: IT + codice trasmittente + progressivo invio. */
function sdiFileName(xml: string, fallback: string): string {
  const country = /<IdTrasmittente>\s*<IdPaese>([A-Z]{2})</.exec(xml)?.[1]
  const code = /<IdTrasmittente>[\s\S]*?<IdCodice>([^<]+)</.exec(xml)?.[1]
  const progressive = /<ProgressivoInvio>([^<]+)</.exec(xml)?.[1]
  return country && code && progressive ? `${country}${code}_${progressive}.xml` : fallback
}

/**
 * Carica nelle bozze di Aruba le fatture preparate in Cambiamenti (bozze con XML), chiedendo
 * conferma per ognuna. Non le invia allo SdI: l'invio si fa dal pannello Aruba.
 */
export async function uploadDrafts(opts: { hidden: boolean }): Promise<void> {
  const client = await supabaseAdmin()
  const { data, error } = await client
    .from('invoices')
    .select('id, number, invoice_date, counterpart_name, total, xml')
    .eq('direction', 'out')
    .eq('status', 'draft')
    .not('xml', 'is', null)
    .order('invoice_date')
  if (error) throw error
  const drafts = (data ?? []) as {
    id: string
    number: string
    invoice_date: string | null
    counterpart_name: string
    total: number | null
    xml: string
  }[]
  if (!drafts.length) {
    console.log('Nessuna fattura pronta: in Cambiamenti premi «Scarica XML» sulla bozza, poi rilancia.')
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const chosen: typeof drafts = []
  try {
    for (const d of drafts) {
      const euro = d.total == null ? '' : ` per € ${Number(d.total).toFixed(2).replace('.', ',')}`
      const answer = await rl.question(
        `Caricare nelle bozze di Aruba la fattura n. ${d.number} del ${d.invoice_date ?? '—'} a ${d.counterpart_name}${euro}? (s/N) `,
      )
      if (/^s/i.test(answer.trim())) chosen.push(d)
    }
  } finally {
    rl.close()
  }
  if (!chosen.length) return

  const { context, api } = await openPanel(opts.hidden)
  try {
    for (const d of chosen) {
      const name = sdiFileName(d.xml, `fattura-${d.number}.xml`)
      try {
        const res = await uploadToDrafts(api, name, d.xml)
        if (!res.ok) {
          console.log(`Fattura n. ${d.number}: Aruba la rifiuta:\n    ${res.messages.join('\n    ')}`)
          continue
        }
        const { error: e } = await client
          .from('invoices')
          .update({ status: 'sent', sdi_status: 'aruba_draft', sdi_status_label: 'Nelle bozze di Aruba: da inviare' })
          .eq('id', d.id)
        if (e) throw e
        console.log(`Fattura n. ${d.number}: caricata nelle bozze di Aruba`)
        for (const m of res.messages) console.log(`    avviso: ${m}`)
      } catch (err) {
        console.log(`Fattura n. ${d.number}: errore (${err instanceof Error ? err.message : err})`)
      }
    }
  } finally {
    await context.close()
  }
  console.log('Ora apri il pannello Aruba → Bozze, controlla e premi «Invia». Poi «npm run aruba -- sincronizza».')
}
