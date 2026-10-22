import { supabase } from '../lib/supabase'
import { importInvoiceBytes, linkInvoiceParties, type InvoiceImportResult } from './invoiceImportCore'

export type { InvoiceImportResult }

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
  return importInvoiceBytes(supabase, raw, onProgress)
}

/** Crea e collega clienti/fornitori per le fatture già importate che non li hanno. */
export function linkPartiesFromInvoices(onProgress?: (done: number, total: number) => void) {
  return linkInvoiceParties(supabase, onProgress)
}
