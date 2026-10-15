import type { EipassCandidate, EipassInvoiceStatus } from '../types/db'
import { invoiceStatusLabels } from '../lib/eipassInvoice'
import { fmtDate } from '../lib/format'
import { eipassExamLabel } from '../lib/eipassStatus'

export function EipassExamBadge({
  candidate,
}: {
  candidate: Pick<EipassCandidate, 'exam_done' | 'exam_date'>
}) {
  const tone = candidate.exam_done
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-amber-50 text-amber-800'
  const title =
    candidate.exam_done && candidate.exam_date ? `Svolto il ${fmtDate(candidate.exam_date)}` : undefined
  return (
    <span
      title={title}
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {eipassExamLabel(candidate)}
    </span>
  )
}

export function InvoiceStatusBadge({ status }: { status: EipassInvoiceStatus }) {
  const tone =
    status === 'fatturato'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'da_fatturare'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-100 text-slate-600'
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {invoiceStatusLabels[status] ?? status}
    </span>
  )
}
