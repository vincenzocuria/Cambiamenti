import { formatInvoiceNumber, nextInvoiceNumber } from '../lib/eipassInvoice'
import { getArubaInvoiceSummary } from './arubaInvoice'
import { listEipassCandidates } from './eipass'
import { listOutInvoiceNumbers } from './invoices'

/**
 * Prossimo numero fattura dell'anno: tiene conto delle fatture nell'app, di quelle EIPASS
 * e dell'ultima emessa su Aruba (anche fuori dall'app), nello stesso formato di quelle Aruba.
 * Se Aruba non risponde lo segnala.
 */
export async function suggestNextInvoiceNumber(
  year: number,
): Promise<{ number: string; arubaChecked: boolean }> {
  const [own, eipass] = await Promise.all([
    listOutInvoiceNumbers(year).catch(() => []),
    listEipassCandidates(),
  ])
  let aruba = 0
  let sample: string | null = null
  let arubaChecked = true
  try {
    const summary = await getArubaInvoiceSummary(year)
    aruba = summary.lastNumber
    sample = summary.sample
  } catch {
    arubaChecked = false
  }
  const next = Number(nextInvoiceNumber([...own, ...eipass], year, aruba))
  return { number: formatInvoiceNumber(next, year, sample), arubaChecked }
}
