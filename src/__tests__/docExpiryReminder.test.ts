import { describe, expect, it } from 'vitest'
import { daysUntil, shouldRemind } from '../../supabase/functions/check-doc-expiry/reminderDays'

describe('promemoria scadenza documenti', () => {
  it('conta i giorni mancanti', () => {
    expect(daysUntil('2026-11-24', '2026-10-25')).toBe(30)
    expect(daysUntil('2026-10-25', '2026-10-25')).toBe(0)
  })

  it('avvisa solo a 30, 7 e 0 giorni', () => {
    expect(shouldRemind(['2026-11-24'], '2026-10-25')).toBe(true)
    expect(shouldRemind(['2026-11-01'], '2026-10-25')).toBe(true)
    expect(shouldRemind(['2026-10-25'], '2026-10-25')).toBe(true)
    expect(shouldRemind(['2026-11-10', '2026-11-02'], '2026-10-25')).toBe(false)
  })
})
