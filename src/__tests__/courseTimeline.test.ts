import { describe, expect, it } from 'vitest'
import { courseTimeline } from '../lib/courseTimeline'

const at = (d: string) => new Date(`${d}T12:00:00`)

describe('courseTimeline', () => {
  it('senza date non mostra nulla', () => {
    expect(courseTimeline(null, '2025-12-09')).toBeNull()
    expect(courseTimeline('2025-12-09', '2025-11-01')).toBeNull()
  })
  it('prima dell’inizio è a 0%', () => {
    const t = courseTimeline('2025-11-03', '2025-12-09', at('2025-11-01'))
    expect(t?.percent).toBe(0)
    expect(t?.label).toContain('Inizia tra 2 giorni')
  })
  it('durante il corso conta i giorni', () => {
    const t = courseTimeline('2025-11-01', '2025-11-10', at('2025-11-05'))
    expect(t?.percent).toBe(50)
    expect(t?.label).toContain('Giorno 5 di 10')
  })
  it('dopo la fine è al 100%', () => {
    expect(courseTimeline('2025-11-03', '2025-12-09', at('2026-10-22'))?.percent).toBe(100)
  })
})
