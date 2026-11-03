import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { PrimaryButton, SecondaryButton } from '../components/Buttons'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { fieldInputClass } from '../components/Field'
import { NavIcon } from '../components/NavIcon'
import { useAuth } from '../hooks/useAuth'
import { fmtDate } from '../lib/format'
import { dueState, shortUser, sortOpenTodos, todayIso, type DueState, type Todo } from '../lib/todos'
import { addTodo, deleteTodo, fetchDoneTodos, fetchOpenTodos, setTodoDone, updateTodo } from '../services/todos'

const dueMeta: Record<Exclude<DueState, null>, { label: string; className: string }> = {
  scaduta: { label: 'Scaduta', className: 'bg-red-50 text-red-700' },
  oggi: { label: 'Oggi', className: 'bg-amber-50 text-amber-900' },
  prossima: { label: 'A breve', className: 'bg-sky-50 text-sky-800' },
}

function fmtDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
}

/** Checklist generale dello staff: spuntata una voce, sparisce (resta tra le fatte per 30 giorni). */
export function TodosPage() {
  const { profile } = useAuth()
  const [open, setOpen] = useState<Todo[]>([])
  const [done, setDone] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string; due_on: string } | null>(null)
  const [showDone, setShowDone] = useState(false)
  // Ultima voce spuntata: per qualche secondo si può annullare.
  const [undo, setUndo] = useState<Todo | null>(null)
  const undoTimer = useRef<number | undefined>(undefined)
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
  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback)
    load()
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      const row = await addTodo(text, dueOn || null)
      setOpen((list) => [...list, row])
      setText('')
      setDueOn('')
      setError('')
      inputRef.current?.focus()
    } catch (err) {
      fail(err, 'Voce non salvata')
    } finally {
      setSaving(false)
    }
  }

  async function markDone(t: Todo) {
    const doneRow = { ...t, done_at: new Date().toISOString(), done_by_email: profile?.email ?? '' }
    setOpen((list) => list.filter((x) => x.id !== t.id))
    setDone((list) => [doneRow, ...list])
    setUndo(doneRow)
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 8000)
    try {
      await setTodoDone(t.id, true, profile?.email ?? null)
    } catch (err) {
      fail(err, 'Aggiornamento non riuscito')
    }
  }

  async function reopen(t: Todo) {
    const row = { ...t, done_at: null, done_by_email: null }
    setDone((list) => list.filter((x) => x.id !== t.id))
    setOpen((list) => [...list, row])
    if (undo?.id === t.id) setUndo(null)
    try {
      await setTodoDone(t.id, false, null)
    } catch (err) {
      fail(err, 'Aggiornamento non riuscito')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing || !editing.text.trim()) return
    const patch = { text: editing.text.trim(), due_on: editing.due_on || null }
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

  const today = todayIso()
  const sorted = sortOpenTodos(open)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Cose da fare</h1>
        <p className="mt-1 text-sm text-slate-500">
          Promemoria condivisi da tutto lo staff. Spunta una voce quando è fatta: sparisce dall&apos;elenco e resta per 30 giorni
          tra le fatte, da dove si può rimettere da fare.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">Nuova cosa da fare</span>
          <input
            ref={inputRef}
            className={fieldInputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Es. Chiamare la Regione per il saldo ED2"
            maxLength={500}
          />
        </label>
        <label className="block sm:w-44">
          <span className="mb-1 block text-xs font-medium text-slate-600">Entro il (facoltativo)</span>
          <input type="date" className={fieldInputClass} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </label>
        <PrimaryButton type="submit" disabled={saving || !text.trim()}>
          Aggiungi
        </PrimaryButton>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Caricamento…</p>}
      {!loading && sorted.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Niente da fare. 🎉
        </p>
      )}

      {sorted.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {sorted.map((t) => {
            const state = dueState(t.due_on, today)
            if (editing?.id === t.id) {
              return (
                <li key={t.id} className="p-3 sm:px-4">
                  <form onSubmit={saveEdit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                      className={fieldInputClass + ' sm:w-44'}
                      value={editing.due_on}
                      onChange={(e) => setEditing({ ...editing, due_on: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <PrimaryButton type="submit" disabled={!editing.text.trim()}>
                        Salva
                      </PrimaryButton>
                      <SecondaryButton type="button" onClick={() => setEditing(null)}>
                        Annulla
                      </SecondaryButton>
                      <button
                        type="button"
                        onClick={() => remove(t)}
                        className="rounded-lg px-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Elimina
                      </button>
                    </div>
                  </form>
                </li>
              )
            }
            return (
              <li key={t.id} className="flex items-start gap-3 p-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => markDone(t)}
                  title="Segna come fatta"
                  aria-label={`Segna come fatta: ${t.text}`}
                  className="group mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-transparent hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
                >
                  <NavIcon name="check" className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line break-words text-sm text-slate-900">{t.text}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {t.due_on && (
                      <span className={state ? 'rounded-full px-2 py-0.5 font-medium ' + dueMeta[state].className : ''}>
                        entro il {fmtDate(t.due_on)}
                        {state && ` · ${dueMeta[state].label}`}
                      </span>
                    )}
                    <span>
                      aggiunta da {shortUser(t.created_by_email)} il {fmtDateTime(t.created_at)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ id: t.id, text: t.text, due_on: t.due_on ?? '' })}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  Modifica
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <CollapsibleSection
        id="fatte"
        title="Fatte negli ultimi 30 giorni"
        badge={done.length}
        badgeTone="muted"
        open={showDone}
        onToggle={() => setShowDone((v) => !v)}
      >
        {done.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna voce spuntata di recente.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {done.map((t) => (
              <li key={t.id} className="flex items-start gap-3 py-2">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <NavIcon name="check" className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-slate-500 line-through">{t.text}</p>
                  <p className="text-xs text-slate-400">
                    fatta da {shortUser(t.done_by_email)} il {fmtDateTime(t.done_at)}
                  </p>
                </div>
                <SecondaryButton size="sm" onClick={() => reopen(t)}>
                  Rimetti da fare
                </SecondaryButton>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      {undo && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="min-w-0 flex-1 truncate">Fatto: {undo.text}</span>
          <button type="button" onClick={() => reopen(undo)} className="shrink-0 font-semibold text-indigo-300 hover:text-indigo-200">
            Annulla
          </button>
        </div>
      )}
    </div>
  )
}
