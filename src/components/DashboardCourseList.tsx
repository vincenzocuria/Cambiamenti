import { Link } from 'react-router-dom'
import type { DashboardCourseRow } from '../services/dashboard'
import { fmtDate } from '../lib/format'
import { CourseStatusBadge } from './CourseStatusBadge'

export function DashboardCourseList({
  title,
  courses,
  empty,
  dateKind = 'start',
  tone = 'neutral',
}: {
  title: string
  courses: DashboardCourseRow[] | null
  empty: string
  dateKind?: 'start' | 'end'
  tone?: 'neutral' | 'warn' | 'ok'
}) {
  const loaded = courses != null
  const count = courses?.length
  const badgeTone =
    tone === 'warn' && loaded && (count ?? 0) > 0
      ? 'bg-amber-50 text-amber-800'
      : tone === 'ok'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-700'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + badgeTone}>
          {loaded ? count : '…'}
        </span>
      </div>
      {!loaded ? (
        <p className="text-sm text-slate-400">Caricamento…</p>
      ) : count === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {(courses ?? []).slice(0, 8).map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/corsi/${c.id}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {c.name}
                  {c.edition ? ` · ${c.edition}` : ''}
                </Link>
                <p className="text-xs text-slate-500">
                  {dateKind === 'start' ? 'Inizio' : 'Fine'}:{' '}
                  {fmtDate(dateKind === 'start' ? c.start_date : c.end_date)}
                </p>
              </div>
              <CourseStatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      )}
      {loaded && (count ?? 0) > 8 && (
        <p className="mt-3 text-xs text-slate-400">+ altri {(count ?? 0) - 8}</p>
      )}
    </div>
  )
}
