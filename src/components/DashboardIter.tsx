import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dueSteps, loadIterOverview, type DueStep } from '../lib/courseIterLoad'
import { fmtDate, formatCourseEdition } from '../lib/format'

/** Passi dell'iter in ritardo, in scadenza e prossimi passi di tutti i corsi. */
export function DashboardIter() {
  const [items, setItems] = useState<DueStep[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    loadIterOverview(supabase, today)
      .then((o) => setItems(dueSteps(o, today, 14)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Errore caricamento iter'))
  }, [])

  const overdue = items?.filter((i) => i.overdue).length ?? 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Iter dei corsi: cosa fare</h2>
        <span className="text-xs text-slate-500">
          {items == null ? '' : overdue ? <span className="font-medium text-red-600">{overdue} in ritardo</span> : 'Nessun ritardo'}
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {items == null && !error && <p className="mt-2 text-sm text-slate-400">Caricamento…</p>}
      {items && !items.length && (
        <p className="mt-2 text-sm text-slate-500">Nessun passo in scadenza nei prossimi 14 giorni. L'iter si imposta dalla scheda del corso.</p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.slice(0, 30).map((i) => (
            <li key={`${i.courseId}-${i.title}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-sm">
              <Link to={`/corsi/${i.courseId}`} className="min-w-0 flex-1 hover:underline">
                <span className="font-medium text-slate-800">{i.title}</span>
                <span className="block truncate text-xs text-slate-500">
                  {i.courseName}
                  {i.edition ? ` · ${formatCourseEdition(i.edition)}` : ''}
                </span>
              </Link>
              {i.isNext && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">Prossimo</span>}
              {i.due_on && (
                <span className={'text-xs tabular-nums ' + (i.overdue ? 'font-medium text-red-600' : 'text-slate-500')}>
                  {i.overdue ? 'scaduto il' : 'entro il'} {fmtDate(i.due_on)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
