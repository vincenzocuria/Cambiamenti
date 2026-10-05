import {
  studentDocumentGapSummary,
  studentDocumentStatusLabel,
  type StudentDocumentCheck,
} from '../lib/studentDocumentStatus'

export function DocumentStatusBadge({ check }: { check: StudentDocumentCheck }) {
  const label = studentDocumentStatusLabel(check.ok)
  const title = check.ok ? label : studentDocumentGapSummary(check.gaps) || label
  const tone = check.ok
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-amber-50 text-amber-800'
  return (
    <span
      title={title}
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  )
}
