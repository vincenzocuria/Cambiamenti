import type { Invoice } from '../types/db'

/** Stato di una fattura: bozza, caricata su Aruba o importata dai file di Aruba. */
export function InvoiceStatusPill({ invoice }: { invoice: Pick<Invoice, 'status' | 'sdi_status' | 'sdi_status_label'> }) {
  const label =
    invoice.status === 'draft'
      ? 'Bozza'
      : invoice.sdi_status_label || invoice.sdi_status || (invoice.status === 'sent' ? 'Caricata su Aruba' : 'Da Aruba')
  const bad = /scart|rifiut|errore|non consegn/i.test(label)
  const good = /consegn|accett|ricevut|caricata|aruba/i.test(label) && !bad
  const tone =
    invoice.status === 'draft'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : bad
        ? 'bg-red-50 text-red-700 ring-red-200'
        : good
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-50 text-slate-600 ring-slate-200'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`}>{label}</span>
  )
}
