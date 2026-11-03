import { matchesSearch } from './matchesSearch'

export interface Todo {
  id: string
  text: string
  due_on: string | null
  urgent: boolean
  created_at: string
  created_by_email: string
  done_at: string | null
  done_by_email: string | null
}

export type DueState = 'scaduta' | 'oggi' | 'prossima' | null

/** Filtro sulla scadenza delle voci da fare. */
export type DueFilter = 'tutte' | 'scadute' | 'oggi' | 'settimana' | 'senza'

export type TodoSort = 'scadenza' | 'recenti' | 'vecchie'

const DAY = 86_400_000

/** Data di oggi in formato AAAA-MM-GG, nel fuso del browser. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Aggiunge giorni a una data AAAA-MM-GG. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return todayIso(new Date(y, m - 1, d + days))
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY)
}

/** Stato della scadenza: scaduta, oggi, entro 3 giorni (prossima) o nessun avviso. */
export function dueState(dueOn: string | null, today: string): DueState {
  if (!dueOn) return null
  if (dueOn < today) return 'scaduta'
  if (dueOn === today) return 'oggi'
  return daysBetween(today, dueOn) <= 3 ? 'prossima' : null
}

/** Scadenza in parole: «scaduta da 2 giorni», «oggi», «domani», «tra 5 giorni». */
export function dueLabel(dueOn: string, today: string): string {
  const diff = daysBetween(today, dueOn)
  if (diff === 0) return 'oggi'
  if (diff === 1) return 'domani'
  if (diff === -1) return 'scaduta ieri'
  if (diff < 0) return `scaduta da ${-diff} giorni`
  return `tra ${diff} giorni`
}

/** Prima le urgenti, poi le voci con scadenza (la più vicina in alto), poi le altre dalla più vecchia. */
export function sortOpenTodos(todos: Todo[], sort: TodoSort = 'scadenza'): Todo[] {
  return [...todos].sort((a, b) => {
    if (sort === 'recenti') return b.created_at.localeCompare(a.created_at)
    if (sort === 'vecchie') return a.created_at.localeCompare(b.created_at)
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
    if (a.due_on && b.due_on) return a.due_on.localeCompare(b.due_on) || a.created_at.localeCompare(b.created_at)
    if (a.due_on) return -1
    if (b.due_on) return 1
    return a.created_at.localeCompare(b.created_at)
  })
}

export function matchesDue(t: Todo, filter: DueFilter, today: string): boolean {
  switch (filter) {
    case 'tutte':
      return true
    case 'scadute':
      return !!t.due_on && t.due_on < today
    case 'oggi':
      return t.due_on === today
    case 'settimana':
      return !!t.due_on && t.due_on >= today && t.due_on <= addDays(today, 7)
    case 'senza':
      return !t.due_on
  }
}

export interface TodoFilters {
  search: string
  due: DueFilter
  urgentOnly: boolean
  mineOnly: boolean
  /** Email dell'utente collegato, per «Solo le mie». */
  me: string | null | undefined
}

/** Voci che passano ricerca e filtri (per le fatte il filtro sulla scadenza non si applica). */
export function filterTodos(todos: Todo[], f: TodoFilters, today: string, applyDue = true): Todo[] {
  const me = (f.me ?? '').toLowerCase()
  return todos.filter(
    (t) =>
      (!applyDue || matchesDue(t, f.due, today)) &&
      (!f.urgentOnly || t.urgent) &&
      (!f.mineOnly || t.created_by_email.toLowerCase() === me || (t.done_by_email ?? '').toLowerCase() === me) &&
      matchesSearch([t.text, t.created_by_email, t.done_by_email ?? ''].join(' '), f.search),
  )
}

export interface TodoStats {
  open: number
  overdue: number
  week: number
  urgent: number
  done30: number
  /** Percentuale di voci chiuse sul totale degli ultimi 30 giorni (0-100). */
  progress: number
}

export function todoStats(open: Todo[], done: Todo[], today: string, now = Date.now()): TodoStats {
  const since = now - 30 * DAY
  const done30 = done.filter((t) => t.done_at && Date.parse(t.done_at) >= since).length
  const total = open.length + done30
  return {
    open: open.length,
    overdue: open.filter((t) => matchesDue(t, 'scadute', today)).length,
    week: open.filter((t) => matchesDue(t, 'settimana', today)).length,
    urgent: open.filter((t) => t.urgent).length,
    done30,
    progress: total ? Math.round((done30 / total) * 100) : 100,
  }
}

/** Nome breve da un indirizzo email (mario.rossi@… → mario.rossi). */
export function shortUser(email: string | null | undefined): string {
  return (email ?? '').split('@')[0] || '—'
}
