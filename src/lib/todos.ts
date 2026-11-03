export interface Todo {
  id: string
  text: string
  due_on: string | null
  created_at: string
  created_by_email: string
  done_at: string | null
  done_by_email: string | null
}

export type DueState = 'scaduta' | 'oggi' | 'prossima' | null

/** Data di oggi in formato AAAA-MM-GG, nel fuso del browser. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Stato della scadenza: scaduta, oggi, entro 3 giorni (prossima) o nessun avviso. */
export function dueState(dueOn: string | null, today: string): DueState {
  if (!dueOn) return null
  if (dueOn < today) return 'scaduta'
  if (dueOn === today) return 'oggi'
  const diff = (Date.parse(dueOn) - Date.parse(today)) / 86_400_000
  return diff <= 3 ? 'prossima' : null
}

/** Prima le voci con scadenza (la più vicina in alto), poi le altre dalla più vecchia. */
export function sortOpenTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.due_on && b.due_on) return a.due_on.localeCompare(b.due_on) || a.created_at.localeCompare(b.created_at)
    if (a.due_on) return -1
    if (b.due_on) return 1
    return a.created_at.localeCompare(b.created_at)
  })
}

/** Nome breve da un indirizzo email (mario.rossi@… → mario.rossi). */
export function shortUser(email: string | null | undefined): string {
  return (email ?? '').split('@')[0] || '—'
}
