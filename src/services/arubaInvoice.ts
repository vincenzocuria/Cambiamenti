import { supabase } from '../lib/supabase'

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('aruba-invoice', { body })
  if (error) {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    if (context && typeof context.json === 'function') {
      const parsed = await context.json().catch(() => null)
      if (parsed?.error) throw new Error(parsed.error)
    }
    throw new Error(error.message || 'Servizio Aruba non raggiungibile')
  }
  const result = data as T & { error?: string }
  if (result?.error) throw new Error(result.error)
  return result
}

/** Verifica che le credenziali Aruba salvate sul server funzionino. */
export function checkArubaConnection(): Promise<{ ok: boolean; account: string | null }> {
  return invoke({ action: 'check' })
}

/** Fatture emesse su Aruba nell'anno: numero più alto, quante ne ha lette e un esempio di numero. */
export async function getArubaInvoiceSummary(
  year: number,
): Promise<{ lastNumber: number; found: number; sample: string | null }> {
  const result = await invoke<{ lastNumber: number; found?: number; sample?: string | null }>({
    action: 'lastNumber',
    year,
  })
  return {
    lastNumber: Number(result.lastNumber) || 0,
    found: Number(result.found) || 0,
    sample: result.sample ?? null,
  }
}

/** Numero più alto delle fatture emesse su Aruba nell'anno (0 se nessuna). */
export async function getArubaLastInvoiceNumber(year: number): Promise<number> {
  return (await getArubaInvoiceSummary(year)).lastNumber
}

/** Carica la fattura su Aruba (che la firma e la invia allo SdI) e segna il corsista come fatturato. */
export function sendInvoiceToAruba(
  candidateId: string,
  xml: string,
): Promise<{ ok: boolean; uploadFileName: string }> {
  return invoke({ action: 'send', candidateId, xml })
}
