import { describe, expect, it } from 'vitest'
import { dueState, shortUser, sortOpenTodos, todayIso, type Todo } from '../lib/todos'

const todo = (over: Partial<Todo>): Todo => ({
  id: Math.random().toString(),
  text: 'x',
  due_on: null,
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
})

describe('helpers', () => {
  it('todayIso e shortUser', () => {
    expect(todayIso(new Date(2026, 10, 3))).toBe('2026-11-03')
    expect(shortUser('elmo.chimento@cambia-menti.it')).toBe('elmo.chimento')
    expect(shortUser(null)).toBe('—')
  })
})
