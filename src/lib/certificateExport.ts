import { fmtDate } from './format'
import type { ExportColumn } from './listExport'
import { courseLabel } from './protocol'
import { certificateLabel, type Certificate } from './quality'

/** Colonne del registro attestati (Excel/PDF); «Firma per ricevuta» resta vuota per la firma a mano. */
export const certificateExportColumns: ExportColumn<Certificate>[] = [
  { header: 'N.', value: (c) => certificateLabel(c) },
  { header: 'Data', value: (c) => fmtDate(c.issued_on) },
  { header: 'Intestatario', value: (c) => c.holder_name },
  { header: 'Codice fiscale', value: (c) => c.holder_tax_code },
  { header: 'Corso', value: (c) => courseLabel(c.course ?? null) },
  { header: 'Titolo', value: (c) => c.title },
  { header: 'Ore', value: (c) => (c.hours != null ? String(c.hours).replace('.', ',') : '') },
  { header: 'Consegnato il', value: (c) => fmtDate(c.delivered_on) },
  { header: 'Modalità', value: (c) => c.delivery_method },
  { header: 'Firma per ricevuta', value: () => '' },
  { header: 'Note', value: (c) => [c.cancelled_at ? `ANNULLATO: ${c.cancelled_reason}` : '', c.notes].filter(Boolean).join(' · ') },
]
