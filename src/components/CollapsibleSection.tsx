import type { ReactNode } from 'react'

export type SectionTone = 'default' | 'ok' | 'warn' | 'muted'

const badgeTone: Record<SectionTone, string> = {
  default: 'bg-indigo-50 text-indigo-700',
  ok: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  muted: 'bg-slate-100 text-slate-500',
}

interface Props {
  id: string
  title: string
  /** Riga sotto il titolo, sempre visibile anche da chiuso. */
  summary?: ReactNode
  badge?: ReactNode
  badgeTone?: SectionTone
  open: boolean
  onToggle: () => void
  /** Pulsanti a destra nell'intestazione (non aprono/chiudono la sezione). */
  actions?: ReactNode
  /** Durante una ricerca senza risultati la sezione si attenua. */
  dimmed?: boolean
  children: ReactNode
}

/** Sezione della scheda con intestazione cliccabile per aprirla o chiuderla. */
export function CollapsibleSection({
  id,
  title,
  summary,
  badge,
  badgeTone: tone = 'default',
  open,
  onToggle,
  actions,
  dimmed = false,
  children,
}: Props) {
  const bodyId = `${id}-body`
  return (
    <section
      id={id}
      className={
        'scroll-mt-28 overflow-hidden rounded-2xl border bg-white shadow-sm transition ' +
        (dimmed ? 'border-slate-200 opacity-50' : 'border-slate-200')
      }
    >
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className={
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition group-hover:border-indigo-300 group-hover:text-indigo-600 ' +
              (open ? 'rotate-90' : '')
            }
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-slate-800 group-hover:text-indigo-700">
                {title}
              </span>
              {badge != null && badge !== '' && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${badgeTone[tone]}`}
                >
                  {badge}
                </span>
              )}
            </span>
            {summary && <span className="mt-0.5 block truncate text-xs text-slate-500">{summary}</span>}
          </span>
        </button>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* Resta montato anche da chiuso: i riquadri non ricaricano e i conteggi restano aggiornati. */}
      <div
        id={bodyId}
        hidden={!open}
        className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4"
      >
        {children}
      </div>
    </section>
  )
}
