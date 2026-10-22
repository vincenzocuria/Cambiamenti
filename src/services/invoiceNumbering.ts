import { formatInvoiceNumber, nextInvoiceNumber } from '../lib/eipassInvoice'
import { listEipassCandidates } from './eipass'
import { listOutInvoiceNumbers } from './invoices'
import { nextSeriesNumber } from '../lib/courseInvoice'

/**
 * Prossimo numero fattura dell'anno, calcolato sulle fatture emesse nel registro (create
 * nell'app o importate dagli XML di Aruba) e su quelle EIPASS, nello stesso formato
 * dell'ultima emessa. Le fatture fatte su Aruba e non ancora importate non sono contate.
 */
export async function suggestNextInvoiceNumber(year: number): Promise<{ number: string; registered: number }> {
  const [own, eipass] = await Promise.all([
    // Senza registro (es. tabella non ancora creata) conta solo le fatture EIPASS
    listOutInvoiceNumbers(year).catch(() => []),
    listEipassCandidates(),
  ])
  const latest = [...own]
    .filter((r) => r.invoice_number)
    .sort((a, b) => (b.invoice_date ?? '').localeCompare(a.invoice_date ?? ''))[0]
  const next = Number(nextInvoiceNumber([...own, ...eipass], year))
  return { number: formatInvoiceNumber(next, year, latest?.invoice_number ?? null), registered: own.length }
}

/** Fatture alla pubblica amministrazione (es. note di debito alla Regione): serie a parte, «FPA 1/26». */
export async function suggestPaInvoiceNumber(year: number): Promise<string> {
  const own = await listOutInvoiceNumbers(year)
  return nextSeriesNumber(
    own.map((r) => r.invoice_number),
    'FPA',
    year,
  )
}

/** Il cliente è una pubblica amministrazione? (codice univoco ufficio di 6 caratteri) */
export function isPublicAdministration(sdiCode: string | null | undefined): boolean {
  return (sdiCode ?? '').trim().length === 6
}
