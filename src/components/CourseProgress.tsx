import { courseStatuses, courseStatusMeta, isCourseStatus } from '../data/courseStatus'
import { courseTimeline } from '../lib/courseTimeline'

/** Barra di avanzamento del corso: fase del ciclo Regione e calendario delle lezioni. */
export function CourseProgress({
  status,
  startDate,
  endDate,
}: {
  status: string
  startDate: string | null
  endDate: string | null
}) {
  const known = isCourseStatus(status)
  const total = courseStatuses.length
  const order = known ? courseStatusMeta[status].order : 0
  // Prima fase = 0%, ultima = 100%
  const percent = known ? Math.round(((order - 1) / (total - 1)) * 100) : 0
  const timeline = courseTimeline(startDate, endDate)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-slate-800">
          Avanzamento corso
          <span className="ml-2 font-normal text-slate-500">
            {known
              ? `Fase ${order} di ${total}: ${courseStatusMeta[status].label}`
              : 'Stato non impostato'}
          </span>
        </p>
        <p className="text-2xl font-bold tabular-nums text-indigo-700">{percent}%</p>
      </div>

      {/* Fasi */}
      <div
        className="relative mt-4"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Avanzamento del corso"
      >
        {/* La linea va dal centro del primo pallino al centro dell'ultimo */}
        <div
          className="absolute top-[11px] h-1.5 rounded-full bg-slate-100"
          style={{ left: 'calc(100% / 14)', right: 'calc(100% / 14)' }}
        />
        <div
          className="absolute top-[11px] h-1.5 rounded-full bg-indigo-500 transition-all"
          style={{ left: 'calc(100% / 14)', width: `calc((100% - 100% / 7) * ${percent / 100})` }}
        />
        <ol className="relative grid grid-cols-7">
          {courseStatuses.map((s) => {
            const meta = courseStatusMeta[s]
            const done = known && meta.order < order
            const current = known && meta.order === order
            return (
              <li key={s} className="flex flex-col items-center text-center" title={meta.description}>
                <span
                  className={
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold ' +
                    (current
                      ? 'border-indigo-600 bg-indigo-600 text-white ring-4 ring-indigo-100'
                      : done
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-slate-200 bg-white text-slate-400')
                  }
                >
                  {done ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    meta.order
                  )}
                </span>
                <span
                  className={
                    'mt-1.5 px-0.5 text-[11px] leading-tight ' +
                    (current
                      ? 'font-semibold text-indigo-700'
                      : done
                        ? 'hidden text-slate-600 sm:block'
                        : 'hidden text-slate-400 sm:block')
                  }
                >
                  {meta.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Calendario */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="font-medium text-slate-600">Calendario lezioni</span>
          <span className="text-slate-500">
            {timeline ? timeline.label : 'Inserisci le date di inizio e fine'}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${timeline?.percent === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${timeline?.percent ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
