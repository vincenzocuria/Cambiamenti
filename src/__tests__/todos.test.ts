import { describe, expect, it } from 'vitest'
import { addDays, dueLabel, dueState, filterTodos, shortUser, sortOpenTodos, todayIso, todoStats, type Todo } from '../lib/todos'

const todo = (over: Partial<Todo>): Todo => ({
  id: Math.random().toString(),
  text: 'x',
  due_on: null,
  urgent: false,
  created_at: '2026-11-01T10:00:00Z',
  created_by_email: 'elmo@example.com',
  done_at: null,
  done_by_email: null,
  ...over,
})

describe('dueState', () => {
  it('segnala scadute, oggi e a breve', () => {
    expect(dueState('2026-11-02', '2026-11-03')).toBe('scaduta')
    expect(dueState('2026-11-03', '2026-11-03')).toBe('oggi')
    expect(dueState('2026-11-06', '2026-11-03')).toBe('prossima')
    expect(dueState('2026-11-07', '2026-11-03')).toBeNull()
    expect(dueState(null, '2026-11-03')).toBeNull()
  })
})

describe('sortOpenTodos', () => {
  it('prima le scadenze più vicine, poi le altre dalla più vecchia', () => {
    const list = [
      todo({ id: 'nodate-new', created_at: '2026-11-02T00:00:00Z' }),
      todo({ id: 'late', due_on: '2026-12-01' }),
      todo({ id: 'nodate-old', created_at: '2026-10-01T00:00:00Z' }),
      todo({ id: 'soon', due_on: '2026-11-05' }),
    ]
    expect(sortOpenTodos(list).map((t) => t.id)).toEqual(['soon', 'late', 'nodate-old', 'nodate-new'])
  })
  it('le urgenti vanno in cima', () => {
    const list = [todo({ id: 'soon', due_on: '2026-11-05' }), todo({ id: 'urg', urgent: true })]
    expect(sortOpenTodos(list).map((t) => t.id)).toEqual(['urg', 'soon'])
  })
})

describe('helpers', () => {
  it('todayIso e shortUser', () => {
    expect(todayIso(new Date(2026, 10, 3))).toBe('2026-11-03')
    expect(shortUser('elmo.chimento@cambia-menti.it')).toBe('elmo.chimento')
    expect(shortUser(null)).toBe('—')
  })
})

describe('filtri e numeri', () => {
  const today = '2026-11-03'
  const list = [
    todo({ id: 'late', due_on: '2026-11-01', text: 'Saldo Regione' }),
    todo({ id: 'today', due_on: today, urgent: true }),
    todo({ id: 'week', due_on: '2026-11-09', created_by_email: 'vincenzo@example.com' }),
    todo({ id: 'far', due_on: '2026-12-20' }),
    todo({ id: 'none' }),
  ]
  const base = { search: '', due: 'tutte' as const, urgentOnly: false, mineOnly: false, me: 'elmo@example.com' }
  const ids = (f: Partial<typeof base> | Record<string, unknown>) =>
    filterTodos(list, { ...base, ...f } as typeof base, today).map((t) => t.id)

  it('filtra per scadenza, urgenza, autore e ricerca', () => {
    expect(ids({ due: 'scadute' })).toEqual(['late'])
    expect(ids({ due: 'oggi' })).toEqual(['today'])
    expect(ids({ due: 'settimana' })).toEqual(['today', 'week'])
    expect(ids({ due: 'senza' })).toEqual(['none'])
    expect(ids({ urgentOnly: true })).toEqual(['today'])
    expect(ids({ mineOnly: true })).not.toContain('week')
    expect(ids({ search: 'regione' })).toEqual(['late'])
  })

  it('conta voci e avanzamento', () => {
    const now = Date.parse('2026-11-03T12:00:00Z')
    const done = [todo({ done_at: '2026-11-02T10:00:00Z' }), todo({ done_at: '2026-08-01T10:00:00Z' })]
    expect(todoStats(list, done, today, now)).toEqual({ open: 5, overdue: 1, week: 2, urgent: 1, done30: 1, progress: 17 })
    expect(todoStats([], [], today, now).progress).toBe(100)
  })

  it('date in parole', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(dueLabel('2026-11-03', today)).toBe('oggi')
    expect(dueLabel('2026-11-04', today)).toBe('domani')
    expect(dueLabel('2026-11-01', today)).toBe('scaduta da 2 giorni')
    expect(dueLabel('2026-11-10', today)).toBe('tra 7 giorni')
  })
})
