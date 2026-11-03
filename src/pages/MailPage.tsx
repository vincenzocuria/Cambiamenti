import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SecondaryButton } from '../components/Buttons'
import { fmtBytes, formatCourseEdition } from '../lib/format'
import { openExternalHref } from '../lib/openExternalHref'
import {
  countPecByStatus,
  fetchPecMessages,
  pecAttachmentUrl,
  setPecStatus,
  type PecAttachmentRow,
  type PecCourseRef,
  type PecMessageRow,
  type PecStatus,
} from '../services/pec'

type Filter = PecStatus | 'tutte'

const filters: { value: Filter; label: string }[] = [
  { value: 'da_verificare', label: 'Da verificare' },
  { value: 'elaborata', label: 'Elaborate da Claude' },
  { value: 'nuova', label: 'Nuove' },
  { value: 'verificata', label: 'Verificate' },
  { value: 'ignorata', label: 'Ignorate' },
  { value: 'tutte', label: 'Tutte' },
]

const statusMeta: Record<PecStatus, { label: string; className: string }> = {
  nuova: { label: 'Nuova', className: 'bg-sky-50 text-sky-800' },
  elaborata: { label: 'Elaborata da Claude', className: 'bg-emerald-50 text-emerald-800' },
  da_verificare: { label: 'Da verificare', className: 'bg-amber-50 text-amber-900' },
  ignorata: { label: 'Ignorata', className: 'bg-slate-100 text-slate-600' },
  verificata: { label: 'Verificata', className: 'bg-teal-50 text-teal-900' },
}

function fmtDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
}

function courseLabel(c: PecCourseRef): string {
  const ed = formatCourseEdition(c.edition)
  return ed ? `${c.name} · ${ed}` : c.name
}

/** PEC copiate dal servizio sul PC: cosa ha fatto Claude e cosa va controllato. */
export function MailPage() {
  const [filter, setFilter] = useState<Filter>('da_verificare')
  const [rows, setRows] = useState<PecMessageRow[]>([])
  const [courses, setCourses] = useState<Map<string, PecCourseRef>>(new Map())
  const [counts, setCounts] = useState<Record<PecStatus, number> | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchPecMessages(filter), countPecByStatus()])
      .then(([res, c]) => {
        setRows(res.rows)
        setCourses(res.courses)
        setCounts(c)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore caricamento PEC'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(load, [load])

  async function markVerified(row: PecMessageRow) {
    try {
      await setPecStatus(row.id, 'verificata')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aggiornamento non riuscito')
    }
  }

  async function openAttachment(a: PecAttachmentRow) {
    try {
      openExternalHref(await pecAttachmentUrl(a), true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allegato non disponibile')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Posta da verificare</h1>
        <p className="mt-1 text-sm text-slate-500">
          PEC di Cambia-Menti copiate ogni 2 ore dal PC. Claude le legge, aggiorna corsi e documenti e scrive qui cosa ha fatto;
          quelle «da verificare» aspettano un controllo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {filters.map((f) => {
          const n = f.value !== 'tutte' && counts ? counts[f.value] : null
          const active = f.value === filter
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.value)}
              className={
                'rounded-full border px-3 py-1.5 text-sm font-medium ' +
                (active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              {f.label}
              {n != null && <span className={'ml-1.5 ' + (active ? 'text-indigo-100' : 'text-slate-400')}>{n}</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Caricamento…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-slate-500">Nessuna PEC in questo elenco.</p>}

      <ul className="space-y-3">
        {rows.map((r) => {
          const meta = statusMeta[r.status]
          const expanded = open === r.id
          return (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">
                    {fmtDateTime(r.sent_at)} · {r.direction === 'in' ? `da ${r.from_address}` : `inviata a ${r.to_addresses}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : r.id)}
                    className="mt-0.5 text-left font-medium text-slate-900 hover:text-indigo-700"
                    aria-expanded={expanded}
                  >
                    {r.subject || '(senza oggetto)'}
                  </button>
                </div>
                <span className={'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ' + meta.className}>{meta.label}</span>
              </div>

              {r.claude_note && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{r.claude_note}</p>}

              {r.course_ids.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5 text-sm">
                  {r.course_ids.map((id) => {
                    const c = courses.get(id)
                    return (
                      <Link key={id} to={`/corsi/${id}`} className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 hover:underline">
                        {c ? courseLabel(c) : 'Corso'}
                      </Link>
                    )
                  })}
                </p>
              )}

              {r.pec_attachments.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5 text-sm">
                  {r.pec_attachments.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={!a.storage_path}
                        onClick={() => openAttachment(a)}
                        className="rounded-md border border-slate-200 px-2 py-0.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        📎 {a.file_name} <span className="text-slate-400">({fmtBytes(Number(a.size_bytes))})</span>
                        {a.document_id && <span className="ml-1 text-emerald-700">· nei documenti</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {expanded && r.body_text && (
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                  {r.body_text}
                </pre>
              )}

              {(r.status === 'da_verificare' || r.status === 'elaborata') && (
                <div className="mt-3">
                  <SecondaryButton size="sm" onClick={() => markVerified(r)}>
                    Segna come verificata
                  </SecondaryButton>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
