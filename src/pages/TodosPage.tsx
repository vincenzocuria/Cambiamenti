import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { PrimaryButton, SecondaryButton } from '../components/Buttons'
import { fieldInputClass } from '../components/Field'
import { KpiCards } from '../components/KpiCards'
import { ListPagination } from '../components/ListPagination'
import { NavIcon } from '../components/NavIcon'
import { SegmentedControl } from '../components/SegmentedControl'
import { useAuth } from '../hooks/useAuth'
import { usePagedSlice } from '../hooks/usePagedSlice'
import { fmtDate } from '../lib/format'
import { describeFilters, exportFilteredList, type ExportColumn } from '../lib/listExport'
import {
  addDays,
  dueLabel,
  dueState,
  filterTodos,
  shortUser,
  sortOpenTodos,
  todayIso,
  todoStats,
  type DueFilter,
  type DueState,
  type Todo,
  type TodoSort,
} from '../lib/todos'
import { addTodo, deleteTodo, fetchDoneTodos, fetchOpenTodos, setTodoDone, updateTodo } from '../services/todos'

const PAGE_SIZE = 20
// Durata dell'animazione di uscita di una voce spuntata (vedi .todo-out in index.css).
const OUT_MS = 550

type View = 'aperte' | 'fatte'

const dueMeta: Record<Exclude<DueState, null>, string> = {
  scaduta: 'bg-red-50 text-red-700 ring-red-200',
  oggi: 'bg-amber-50 text-amber-900 ring-amber-200',
  prossima: 'bg-sky-50 text-sky-800 ring-sky-200',
}

const dueOptions: { value: DueFilter; label: string }[] = [
  { value: 'tutte', label: 'Tutte' },
  { value: 'scadute', label: 'Scadute' },
  { value: 'oggi', label: 'Oggi' },
  { value: 'settimana', label: 'Entro 7 giorni' },
  { value: 'senza', label: 'Senza data' },
]

const sortLabels: Record<TodoSort, string> = {
  scadenza: 'Urgenti e scadenze prima',
  recenti: 'Aggiunte di recente',
  vecchie: 'Aggiunte da più tempo',
}

const sparkColors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6']

function fmtDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
}

/** Numero che sale fino al valore (effetto contatore), fermo se il sistema chiede meno animazioni. */
function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - k, 3)
      setValue(Math.round(start + (target - start) * eased))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

/** Anello di avanzamento nella testata. */
function ProgressRing({ percent }: { percent: number }) {
  const shown = useCountUp(percent, 900)
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-bold tabular-nums">{shown}%</span>
        <span className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: 'rgb(255 255 255 / 0.75)' }}>
          fatto
        </span>
      </span>
    </div>
  )
}

/** Scintille attorno al cerchio appena spuntato. */
function Sparks() {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="todo-spark"
          style={{ '--a': `${i * 36}deg`, backgroundColor: sparkColors[i % sparkColors.length] } as CSSProperties}
        />
      ))}
    </>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ' +
        (active ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
      }
    >
      {children}
    </button>
  )
}

/** Checklist generale dello staff: spuntata una voce, sparisce (resta tra le fatte, da dove si può rimettere). */
export function TodosPage() {
  const { profile } = useAuth()
  const me = profile?.email ?? null
  const [open, setOpen] = useState<Todo[]>([])
  const [done, setDone] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Nuova voce
  const [text, setText] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  // Elenco
  const [view, setView] = useState<View>('aperte')
  const [search, setSearch] = useState('')
  const [due, setDue] = useState<DueFilter>('tutte')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [sort, setSort] = useState<TodoSort>('scadenza')
  const [editing, setEditing] = useState<{ id: string; text: string; due_on: string; urgent: boolean } | null>(null)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())

  // Ultima voce spuntata: per qualche secondo si può annullare.
  const [undo, setUndo] = useState<Todo | null>(null)
  const undoTimer = useRef<number | undefined>(undefined)
  const leaveTimers = useRef(new Map<string, number>())
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    Promise.all([fetchOpenTodos(), fetchDoneTodos()])
      .then(([o, d]) => {
        setOpen(o)
        setDone(d)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore caricamento'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])
  useEffect(() => {
    const timers = leaveTimers.current
    return () => {
      window.clearTimeout(undoTimer.current)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback)
    load()
  }

  const today = todayIso()
  const stats = useMemo(() => todoStats(open, done, today), [open, done, today])
  const visible = useMemo(() => {
    const filters = { search, due, urgentOnly, mineOnly, me }
    return view === 'aperte'
      ? sortOpenTodos(filterTodos(open, filters, today), sort)
      : filterTodos(done, filters, today, false)
  }, [view, open, done, search, due, urgentOnly, mineOnly, me, sort, today])
  const resetKey = [view, search, due, urgentOnly, mineOnly, sort].join('|')
  const { page, setPage, pages, slice } = usePagedSlice(visible, resetKey, PAGE_SIZE)
  const anyFilter = search.trim() !== '' || due !== 'tutte' || urgentOnly || mineOnly

  function clearFilters() {
    setSearch('')
    setDue('tutte')
    setUrgentOnly(false)
    setMineOnly(false)
  }

  function showOpen(nextDue: DueFilter, onlyUrgent = false) {
    setView('aperte')
    setDue(nextDue)
    setUrgentOnly(onlyUrgent)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      const row = await addTodo(text, dueOn || null, urgent)
      setOpen((list) => [...list, row])
      setJustAdded(row.id)
      setText('')
      setDueOn('')
      setUrgent(false)
      setError('')
      setView('aperte')
      inputRef.current?.focus()
    } catch (err) {
      fail(err, 'Voce non salvata')
    } finally {
      setSaving(false)
    }
  }

  async function markDone(t: Todo) {
    if (leaving.has(t.id)) return
    const doneRow = { ...t, done_at: new Date().toISOString(), done_by_email: me ?? '' }
    // Prima l'animazione (spunta, scintille, uscita), poi la voce lascia l'elenco.
    setLeaving((s) => new Set(s).add(t.id))
    const timer = window.setTimeout(() => {
      leaveTimers.current.delete(t.id)
      setOpen((list) => list.filter((x) => x.id !== t.id))
      setDone((list) => [doneRow, ...list])
      setLeaving((s) => {
        const next = new Set(s)
        next.delete(t.id)
        return next
      })
    }, OUT_MS)
    leaveTimers.current.set(t.id, timer)
    setUndo(doneRow)
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 8000)
    try {
      await setTodoDone(t.id, true, me)
    } catch (err) {
      fail(err, 'Aggiornamento non riuscito')
    }
  }

  async function reopen(t: Todo) {
    const row = { ...t, done_at: null, done_by_email: null }
    // Annullata durante l'animazione: la voce resta dov'è.
    const pending = leaveTimers.current.get(t.id)
    if (pending) {
      window.clearTimeout(pending)
      leaveTimers.current.delete(t.id)
      setLeaving((s) => {
        const next = new Set(s)
        next.delete(t.id)
        return next
      })
    }
    setDone((list) => list.filter((x) => x.id !== t.id))
    setOpen((list) => (list.some((x) => x.id === t.id) ? list : [...list, row]))
    setJustAdded(t.id)
    if (undo?.id === t.id) setUndo(null)
    try {
      await setTodoDone(t.id, false, null)
    } catch (err) {
      fail(err, 'Aggiornamento non riuscito')
    }
  }

  async function toggleUrgent(t: Todo) {
    setOpen((list) => list.map((x) => (x.id === t.id ? { ...x, urgent: !t.urgent } : x)))
    try {
      await updateTodo(t.id, { urgent: !t.urgent })
    } catch (err) {
      fail(err, 'Modifica non salvata')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing || !editing.text.trim()) return
    const patch = { text: editing.text.trim(), due_on: editing.due_on || null, urgent: editing.urgent }
    setOpen((list) => list.map((x) => (x.id === editing.id ? { ...x, ...patch } : x)))
    setEditing(null)
    try {
      await updateTodo(editing.id, patch)
    } catch (err) {
      fail(err, 'Modifica non salvata')
    }
  }

  async function remove(t: Todo) {
    if (!window.confirm(`Eliminare «${t.text}»? Non comparirà neanche tra le fatte.`)) return
    setOpen((list) => list.filter((x) => x.id !== t.id))
    setDone((list) => list.filter((x) => x.id !== t.id))
    setEditing(null)
    try {
      await deleteTodo(t.id)
    } catch (err) {
      fail(err, 'Eliminazione non riuscita')
    }
  }

  function exportList(format: 'excel' | 'pdf') {
    const columns: ExportColumn<Todo>[] = [
      { header: 'Cosa fare', value: (t) => t.text },
      { header: 'Urgente', value: (t) => (t.urgent ? 'Sì' : '') },
      { header: 'Entro il', value: (t) => (t.due_on ? fmtDate(t.due_on) : '') },
      { header: 'Aggiunta da', value: (t) => shortUser(t.created_by_email) },
      { header: 'Aggiunta il', value: (t) => fmtDateTime(t.created_at) },
      ...(view === 'fatte'
        ? [
            { header: 'Fatta da', value: (t: Todo) => shortUser(t.done_by_email) },
            { header: 'Fatta il', value: (t: Todo) => fmtDateTime(t.done_at) },
          ]
        : []),
    ]
    exportFilteredList({
      title: view === 'aperte' ? 'Cose da fare' : 'Cose fatte',
      rows: visible,
      columns,
      format,
      filters: describeFilters([
        view === 'aperte' && due !== 'tutte' && dueOptions.find((o) => o.value === due)?.label,
        urgentOnly && 'solo urgenti',
        mineOnly && 'solo le mie',
        search.trim() && `ricerca «${search.trim()}»`,
      ]),
    })
  }

  // Nome per il saluto: dal profilo, altrimenti dall'email (mario.rossi86@… → Mario).
  const firstName = (profile?.full_name?.trim().split(/\s+/)[0] || (me ?? '').split('@')[0].split(/[._-]/)[0]).replace(/\d+/g, '')
  const greeting = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : ''

  return (
    <div className="space-y-6">
      {/* Testata */}
      <section className="todo-hero todo-hero-shine relative overflow-hidden rounded-3xl p-5 shadow-lg sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgb(255 255 255 / 0.22), transparent 70%)' }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: 'rgb(255 255 255 / 0.8)' }}>
              {greeting ? `Ciao ${greeting},` : 'Ciao,'}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">Cose da fare</h1>
            <p className="mt-1.5 max-w-xl text-sm" style={{ color: 'rgb(255 255 255 / 0.85)' }}>
              {stats.open === 0
                ? 'Niente in sospeso: tutto fatto!'
                : stats.overdue > 0
                  ? `${stats.open} ${stats.open === 1 ? 'voce aperta' : 'voci aperte'}, di cui ${stats.overdue} ${stats.overdue === 1 ? 'scaduta' : 'scadute'}.`
                  : `${stats.open} ${stats.open === 1 ? 'voce aperta' : 'voci aperte'}, nessuna scaduta.`}{' '}
              Promemoria condivisi da tutto lo staff: spunta quando è fatta e la voce sparisce.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing percent={stats.progress} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgb(255 255 255 / 0.8)' }}>
              <span className="block text-base font-semibold" style={{ color: '#fff' }}>
                {stats.done30} fatte
              </span>
              negli ultimi 30 giorni
            </p>
          </div>
        </div>
      </section>

      <KpiCards
        className=""
        items={[
          {
            key: 'open',
            label: 'Da fare',
            value: stats.open,
            hint: 'tutte le voci aperte',
            active: view === 'aperte' && due === 'tutte' && !urgentOnly,
            onClick: () => showOpen('tutte'),
          },
          {
            key: 'overdue',
            label: 'Scadute',
            value: stats.overdue,
            hint: stats.overdue ? 'da recuperare' : 'nessun ritardo',
            tone: stats.overdue ? 'warn' : 'ok',
            active: view === 'aperte' && due === 'scadute',
            onClick: () => showOpen('scadute'),
          },
          {
            key: 'week',
            label: 'Entro 7 giorni',
            value: stats.week,
            hint: 'in scadenza a breve',
            active: view === 'aperte' && due === 'settimana',
            onClick: () => showOpen('settimana'),
          },
          {
            key: 'urgent',
            label: 'Urgenti',
            value: stats.urgent,
            hint: 'segnate con la stella',
            tone: stats.urgent ? 'warn' : 'default',
            active: view === 'aperte' && urgentOnly,
            onClick: () => showOpen('tutte', true),
          },
          {
            key: 'done',
            label: 'Fatte (30 giorni)',
            value: stats.done30,
            hint: 'si possono rimettere da fare',
            tone: 'ok',
            active: view === 'fatte',
            onClick: () => setView('fatte'),
          },
        ]}
      />

      {/* Nuova voce */}
      <form onSubmit={handleAdd} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Nuova cosa da fare</span>
            <input
              ref={inputRef}
              className={fieldInputClass + ' h-11 text-base'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Es. Chiamare la Regione per il saldo ED2"
              maxLength={500}
            />
          </label>
          <label className="block lg:w-44">
            <span className="mb-1 block text-xs font-medium text-slate-600">Entro il (facoltativo)</span>
            <input type="date" className={fieldInputClass + ' h-11'} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </label>
          <PrimaryButton type="submit" disabled={saving || !text.trim()} className="h-11">
            {saving ? 'Salvo…' : '+ Aggiungi'}
          </PrimaryButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-slate-500">Scadenza rapida:</span>
          {[
            { label: 'Oggi', value: today },
            { label: 'Domani', value: addDays(today, 1) },
            { label: 'Tra una settimana', value: addDays(today, 7) },
          ].map((q) => (
            <Chip key={q.label} active={dueOn === q.value} onClick={() => setDueOn(dueOn === q.value ? '' : q.value)}>
              {q.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          <Chip active={urgent} onClick={() => setUrgent((v) => !v)}>
            ★ Urgente
          </Chip>
        </div>
      </form>

      {/* Filtri e ricerca */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            ariaLabel="Voci da mostrare"
            value={view}
            onChange={setView}
            options={[
              { value: 'aperte', label: `Da fare (${stats.open})` },
              { value: 'fatte', label: `Fatte (${done.length})` },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton type="button" onClick={() => exportList('excel')} className="!px-3 !py-1.5 !text-xs">
              Excel
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => exportList('pdf')} className="!px-3 !py-1.5 !text-xs">
              PDF
            </SecondaryButton>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            placeholder="Cerca nel testo o per persona…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={fieldInputClass + ' lg:max-w-xs'}
          />
          {view === 'aperte' && (
            <select
              aria-label="Ordina"
              value={sort}
              onChange={(e) => setSort(e.target.value as TodoSort)}
              className={fieldInputClass + ' lg:w-56'}
            >
              {(Object.keys(sortLabels) as TodoSort[]).map((k) => (
                <option key={k} value={k}>
                  {sortLabels[k]}
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap gap-2">
            <Chip active={urgentOnly} onClick={() => setUrgentOnly((v) => !v)}>
              ★ Solo urgenti
            </Chip>
            <Chip active={mineOnly} onClick={() => setMineOnly((v) => !v)}>
              Solo le mie
            </Chip>
          </div>
        </div>
        {view === 'aperte' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Scadenza">
            {dueOptions.map((o) => (
              <Chip key={o.value} active={due === o.value} onClick={() => setDue(o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            {visible.length} {visible.length === 1 ? 'voce' : 'voci'}
            {anyFilter && ' con questi filtri'}
          </span>
          {anyFilter && (
            <button type="button" onClick={clearFilters} className="font-medium text-indigo-700 hover:underline">
              Togli i filtri
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <ul className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <div className="todo-in rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
          <p className="todo-float text-5xl" aria-hidden>
            {view === 'aperte' && !anyFilter ? '🎉' : '🔍'}
          </p>
          <p className="mt-4 text-base font-semibold text-slate-800">
            {view === 'aperte' && !anyFilter
              ? 'Tutto fatto!'
              : view === 'fatte' && !anyFilter
                ? 'Ancora nessuna voce spuntata'
                : 'Nessuna voce con questi filtri'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {view === 'aperte' && !anyFilter
              ? 'Non c’è niente in sospeso. Aggiungi qui sopra la prossima cosa da fare.'
              : anyFilter
                ? 'Prova a cambiare la ricerca o i filtri.'
                : 'Le voci spuntate restano qui per 90 giorni.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {slice.map((t, i) => {
            const style = { animationDelay: `${Math.min(i, 10) * 30}ms` }
            if (view === 'fatte') {
              return (
                <li key={t.id} className="todo-in flex items-start gap-3 p-3 sm:px-4" style={style}>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <NavIcon name="check" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm text-slate-500 line-through">{t.text}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      fatta da <span className="font-medium text-slate-500">{shortUser(t.done_by_email)}</span> il{' '}
                      {fmtDateTime(t.done_at)} · aggiunta da {shortUser(t.created_by_email)}
                    </p>
                  </div>
                  <SecondaryButton size="sm" onClick={() => reopen(t)}>
                    Rimetti da fare
                  </SecondaryButton>
                </li>
              )
            }
            if (editing?.id === t.id) {
              return (
                <li key={t.id} className="bg-indigo-50/40 p-3 sm:px-4">
                  <form onSubmit={saveEdit} className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <input
                      autoFocus
                      aria-label="Testo"
                      className={fieldInputClass + ' min-w-0 flex-1'}
                      value={editing.text}
                      maxLength={500}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                    />
                    <input
                      type="date"
                      aria-label="Entro il"
                      className={fieldInputClass + ' lg:w-44'}
                      value={editing.due_on}
                      onChange={(e) => setEditing({ ...editing, due_on: e.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip active={editing.urgent} onClick={() => setEditing({ ...editing, urgent: !editing.urgent })}>
                        ★ Urgente
                      </Chip>
                      <PrimaryButton type="submit" disabled={!editing.text.trim()}>
                        Salva
                      </PrimaryButton>
                      <SecondaryButton type="button" onClick={() => setEditing(null)}>
                        Annulla
                      </SecondaryButton>
                      <button
                        type="button"
                        onClick={() => remove(t)}
                        className="rounded-lg px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Elimina
                      </button>
                    </div>
                  </form>
                </li>
              )
            }
            const state = dueState(t.due_on, today)
            const out = leaving.has(t.id)
            return (
              <li
                key={t.id}
                className={
                  'group relative flex items-start gap-3 p-3 transition-colors hover:bg-slate-50 sm:px-4 ' +
                  (out ? 'todo-out' : t.id === justAdded ? 'todo-in bg-indigo-50/50' : 'todo-in')
                }
                style={out ? undefined : style}
              >
                {t.urgent && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-amber-400" />}
                <button
                  type="button"
                  onClick={() => markDone(t)}
                  title="Segna come fatta"
                  aria-label={`Segna come fatta: ${t.text}`}
                  className={
                    'relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ' +
                    (out
                      ? 'todo-pop border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 text-transparent hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600')
                  }
                >
                  <NavIcon name="check" className="h-4 w-4" />
                  {out && <Sparks />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="todo-text whitespace-pre-line break-words text-sm font-medium text-slate-900">{t.text}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {t.urgent && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900 ring-1 ring-amber-200">★ Urgente</span>}
                    {t.due_on && (
                      <span
                        className={
                          'rounded-full px-2 py-0.5 font-medium ring-1 ' +
                          (state ? dueMeta[state] : 'bg-slate-50 text-slate-600 ring-slate-200')
                        }
                        title={`Entro il ${fmtDate(t.due_on)}`}
                      >
                        📅 {fmtDate(t.due_on)} · {dueLabel(t.due_on, today)}
                      </span>
                    )}
                    <span>
                      aggiunta da {shortUser(t.created_by_email)} il {fmtDateTime(t.created_at)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:opacity-60 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => toggleUrgent(t)}
                    title={t.urgent ? 'Togli urgente' : 'Segna come urgente'}
                    aria-label={t.urgent ? 'Togli urgente' : 'Segna come urgente'}
                    className={
                      'rounded-lg px-2 py-1 text-base leading-none hover:bg-amber-50 ' + (t.urgent ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500')
                    }
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: t.id, text: t.text, due_on: t.due_on ?? '', urgent: t.urgent })}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  >
                    Modifica
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ListPagination page={page} pages={pages} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />

      {undo && (
        <div
          role="status"
          className="todo-toast fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-indigo-600 px-4 py-3 text-sm text-white shadow-xl"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgb(255 255 255 / 0.2)' }}>
            <NavIcon name="check" className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate">Fatto: {undo.text}</span>
          <button
            type="button"
            onClick={() => reopen(undo)}
            className="shrink-0 rounded-lg px-2 py-1 font-semibold text-white underline-offset-2 hover:underline"
          >
            Annulla
          </button>
        </div>
      )}
    </div>
  )
}
