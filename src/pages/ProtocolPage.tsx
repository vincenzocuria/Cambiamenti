import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PrimaryButton, SecondaryButton } from '../components/Buttons'
import { fieldInputClass } from '../components/Field'
import { ListPagination } from '../components/ListPagination'
import { SegmentedControl } from '../components/SegmentedControl'
import { usePagedSlice } from '../hooks/usePagedSlice'
import { fmtDate } from '../lib/format'
import { describeFilters, exportFilteredList, type ExportColumn } from '../lib/listExport'
import {
  channels,
  courseLabel,
  directionLabels,
  filterProtocol,
  nextNumber,
  numberingGaps,
  protocolLabel,
  sortProtocol,
  type ProtocolChannel,
  type ProtocolDirection,
  type ProtocolEntry,
} from '../lib/protocol'
import { listCourses } from '../services/courses'
import { cancelProtocol, listProtocol, registerProtocol, updateProtocol } from '../services/protocol'
import type { Course } from '../types/db'

const PAGE_SIZE = 25
const today = () => new Date().toISOString().slice(0, 10)

type Draft = {
  entry_date: string
  direction: ProtocolDirection
  counterpart: string
  subject: string
  channel: ProtocolChannel
  external_ref: string
  notes: string
  course_id: string
  number: string
}

const emptyDraft = (): Draft => ({
  entry_date: today(),
  direction: 'uscita',
  counterpart: '',
  subject: '',
  channel: 'PEC',
  external_ref: '',
  notes: '',
  course_id: '',
  number: '',
})

const directionTone: Record<ProtocolDirection, string> = {
  uscita: 'bg-indigo-50 text-indigo-700',
  entrata: 'bg-emerald-50 text-emerald-700',
  interno: 'bg-slate-100 text-slate-600',
}

const exportColumns: ExportColumn<ProtocolEntry>[] = [
  { header: 'N.', value: (e) => protocolLabel(e) },
  { header: 'Data', value: (e) => fmtDate(e.entry_date) },
  { header: 'Tipo', value: (e) => directionLabels[e.direction] },
  { header: 'Mittente / destinatario', value: (e) => e.counterpart },
  { header: 'Oggetto', value: (e) => e.subject },
  { header: 'Mezzo', value: (e) => e.channel },
  { header: 'Rif. esterno', value: (e) => e.external_ref },
  { header: 'Corso', value: (e) => courseLabel(e.course ?? null) },
  { header: 'Note', value: (e) => [e.cancelled_at ? `ANNULLATO: ${e.cancelled_reason}` : '', e.notes].filter(Boolean).join(' · ') },
]

function EntryForm({
  draft,
  setDraft,
  courses,
  editing,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  courses: Course[]
  editing: boolean
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Data</span>
        <input type="date" className={fieldInputClass} value={draft.entry_date} onChange={(e) => set('entry_date', e.target.value)} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Tipo</span>
        <select className={fieldInputClass} value={draft.direction} onChange={(e) => set('direction', e.target.value as ProtocolDirection)}>
          {(Object.keys(directionLabels) as ProtocolDirection[]).map((d) => (
            <option key={d} value={d}>
              {directionLabels[d]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Mezzo</span>
        <select className={fieldInputClass} value={draft.channel} onChange={(e) => set('channel', e.target.value as ProtocolChannel)}>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {!editing && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Numero</span>
          <input
            className={fieldInputClass}
            inputMode="numeric"
            placeholder="automatico"
            value={draft.number}
            onChange={(e) => set('number', e.target.value.replace(/\D/g, ''))}
          />
          <span className="mt-1 block text-xs text-slate-400">Lascia vuoto per il prossimo libero</span>
        </label>
      )}
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {draft.direction === 'entrata' ? 'Mittente' : 'Destinatario'}
        </span>
        <input
          className={fieldInputClass}
          value={draft.counterpart}
          onChange={(e) => set('counterpart', e.target.value)}
          placeholder="es. Regione Calabria – Dipartimento Lavoro"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Corso (facoltativo)</span>
        <select className={fieldInputClass} value={draft.course_id} onChange={(e) => set('course_id', e.target.value)}>
          <option value="">— nessuno —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {courseLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2 lg:col-span-4">
        <span className="mb-1 block text-xs font-medium text-slate-600">Oggetto</span>
        <textarea
          className={fieldInputClass}
          rows={2}
          value={draft.subject}
          onChange={(e) => set('subject', e.target.value)}
          required
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Protocollo dell'altro ente</span>
        <input
          className={fieldInputClass}
          value={draft.external_ref}
          onChange={(e) => set('external_ref', e.target.value)}
          placeholder="es. prot. n. 730877 del 08/09/2026"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Note</span>
        <input className={fieldInputClass} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </div>
  )
}

export function ProtocolPage() {
  const [entries, setEntries] = useState<ProtocolEntry[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState<number | 'tutti'>(thisYear)
  const [direction, setDirection] = useState<ProtocolDirection | 'tutte'>('tutte')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([listProtocol(), listCourses()])
      setEntries(p)
      setCourses(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const years = useMemo(() => {
    const set = new Set(entries.map((e) => e.year))
    set.add(thisYear)
    return [...set].sort((a, b) => b - a)
  }, [entries, thisYear])

  const filtered = useMemo(
    () => sortProtocol(filterProtocol(entries, { year, direction, query })),
    [entries, year, direction, query],
  )
  const { page, setPage, pages, slice } = usePagedSlice(filtered, `${year}|${direction}|${query}`, PAGE_SIZE)
  const draftYear = Number(draft.entry_date.slice(0, 4)) || thisYear
  const next = nextNumber(entries, draftYear)
  const gaps = year === 'tutti' ? [] : numberingGaps(entries, year)

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setError('')
    setInfo('')
    if (!draft.subject.trim()) {
      setError("Scrivi l'oggetto")
      return
    }
    setBusy(true)
    try {
      const row = await registerProtocol({
        entry_date: draft.entry_date,
        direction: draft.direction,
        counterpart: draft.counterpart,
        subject: draft.subject,
        channel: draft.channel,
        external_ref: draft.external_ref,
        notes: draft.notes,
        course_id: draft.course_id || null,
        number: draft.number ? Number(draft.number) : null,
      })
      setInfo(`Protocollato con il n. ${protocolLabel(row)} del ${fmtDate(row.entry_date)}`)
      setDraft(emptyDraft())
      setShowNew(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registrazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(e: ProtocolEntry) {
    setEditId(e.id)
    setEditDraft({
      entry_date: e.entry_date,
      direction: e.direction,
      counterpart: e.counterpart,
      subject: e.subject,
      channel: e.channel,
      external_ref: e.external_ref,
      notes: e.notes,
      course_id: e.course_id ?? '',
      number: String(e.number),
    })
  }

  async function saveEdit(e: ProtocolEntry) {
    setError('')
    if (editDraft.entry_date.slice(0, 4) !== String(e.year)) {
      setError(`La data deve restare nel ${e.year}, l'anno del numero ${protocolLabel(e)}`)
      return
    }
    setBusy(true)
    try {
      await updateProtocol(e.id, {
        entry_date: editDraft.entry_date,
        direction: editDraft.direction,
        counterpart: editDraft.counterpart.trim(),
        subject: editDraft.subject.trim(),
        channel: editDraft.channel,
        external_ref: editDraft.external_ref.trim(),
        notes: editDraft.notes.trim(),
        course_id: editDraft.course_id || null,
      })
      setEditId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    } finally {
      setBusy(false)
    }
  }

  async function toggleCancel(e: ProtocolEntry) {
    let reason: string | null = null
    if (!e.cancelled_at) {
      reason = window.prompt(`Motivo dell'annullamento del n. ${protocolLabel(e)}`, '')
      if (reason == null) return
      if (!reason.trim()) {
        setError("Indica il motivo dell'annullamento")
        return
      }
    }
    setBusy(true)
    try {
      await cancelProtocol(e.id, reason?.trim() ?? null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: `Registro di protocollo${year === 'tutti' ? '' : ` ${year}`}`,
      rows: [...filtered].reverse(),
      columns: exportColumns,
      filters: describeFilters([
        year !== 'tutti' && `anno ${year}`,
        direction !== 'tutte' && directionLabels[direction],
        query && `ricerca «${query}»`,
      ]),
      format,
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Protocollo</h1>
          <p className="text-sm text-slate-500">
            Registro della corrispondenza in uscita e in entrata. Prossimo numero {draftYear}: <strong>{next}/{draftYear}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={() => exportList('excel')} disabled={!filtered.length}>
            Excel
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => exportList('pdf')} disabled={!filtered.length}>
            PDF
          </SecondaryButton>
          <PrimaryButton type="button" onClick={() => setShowNew((v) => !v)}>
            {showNew ? 'Chiudi' : 'Nuovo protocollo'}
          </PrimaryButton>
        </div>
      </div>

      {showNew && (
        <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <EntryForm draft={draft} setDraft={setDraft} courses={courses} editing={false} />
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? 'Registro…' : `Protocolla (n. ${draft.number || next}/${draftYear})`}
            </PrimaryButton>
            <span className="text-xs text-slate-500">Il numero definitivo lo assegna il gestionale al salvataggio.</span>
          </div>
        </form>
      )}

      {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select
          className={`${fieldInputClass} lg:w-36`}
          value={String(year)}
          onChange={(e) => setYear(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))}
          aria-label="Anno"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          <option value="tutti">Tutti gli anni</option>
        </select>
        <SegmentedControl
          ariaLabel="Tipo"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'tutte', label: 'Tutti' },
            { value: 'uscita', label: 'In uscita' },
            { value: 'entrata', label: 'In entrata' },
            { value: 'interno', label: 'Interni' },
          ]}
        />
        <input
          className={`${fieldInputClass} lg:flex-1`}
          placeholder="Cerca numero, oggetto, destinatario, corso…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {gaps.length > 0 && (
        <p className="text-xs text-amber-700">
          Numeri mancanti nel {year}: {gaps.slice(0, 30).join(', ')}
          {gaps.length > 30 ? '…' : ''}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carico…</p>
      ) : !filtered.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Nessun protocollo {entries.length ? 'con questi filtri' : 'ancora registrato'}.
        </p>
      ) : (
        <div className="space-y-2">
          {slice.map((e) =>
            editId === e.id ? (
              <div key={e.id} className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">Modifica n. {protocolLabel(e)}</p>
                <EntryForm draft={editDraft} setDraft={setEditDraft} courses={courses} editing />
                <div className="flex gap-2">
                  <PrimaryButton type="button" onClick={() => void saveEdit(e)} disabled={busy}>
                    Salva
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setEditId(null)}>
                    Annulla
                  </SecondaryButton>
                </div>
              </div>
            ) : (
              <div
                key={e.id}
                className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${e.cancelled_at ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className={`font-mono text-sm font-semibold ${e.cancelled_at ? 'line-through' : 'text-slate-900'}`}>
                    {protocolLabel(e)}
                  </span>
                  <span className="text-sm text-slate-500">{fmtDate(e.entry_date)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${directionTone[e.direction]}`}>
                    {directionLabels[e.direction]} · {e.channel}
                  </span>
                  {e.cancelled_at && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      Annullato: {e.cancelled_reason}
                    </span>
                  )}
                  <span className="ml-auto flex gap-3 text-xs">
                    <button type="button" className="text-slate-500 underline hover:text-slate-700" onClick={() => startEdit(e)}>
                      Modifica
                    </button>
                    <button
                      type="button"
                      className="text-slate-500 underline hover:text-slate-700"
                      onClick={() => void toggleCancel(e)}
                      disabled={busy}
                    >
                      {e.cancelled_at ? 'Ripristina' : 'Annulla numero'}
                    </button>
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-800">{e.subject}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[
                    e.counterpart && `${e.direction === 'entrata' ? 'Da' : 'A'}: ${e.counterpart}`,
                    e.external_ref && `Rif. ${e.external_ref}`,
                    e.notes,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {e.course && (
                    <>
                      {' · '}
                      <Link to={`/corsi/${e.course.id}`} className="text-indigo-600 hover:underline">
                        {courseLabel(e.course)}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            ),
          )}
          <ListPagination page={page} pages={pages} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
