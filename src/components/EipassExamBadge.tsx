import type { EipassCandidate } from '../types/db'
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
