import { describe, expect, it } from 'vitest'
import { agentOnline, autoSyncDue, defaultYears } from '../lib/arubaSync'

describe('sincronizzazione Aruba dal gestionale', () => {
  const now = new Date('2026-10-23T10:00:00Z').getTime()

  it('il PC è collegato se ha dato segnale negli ultimi 2 minuti', () => {
    expect(agentOnline({ last_seen_at: '2026-10-23T09:59:00Z' }, now)).toBe(true)
    expect(agentOnline({ last_seen_at: '2026-10-23T09:55:00Z' }, now)).toBe(false)
    expect(agentOnline(null, now)).toBe(false)
  })

  it('sincronizza da solo quando l’ultima è più vecchia dell’intervallo', () => {
    expect(autoSyncDue(null, 6, now)).toBe(true)
    expect(autoSyncDue('2026-10-23T05:00:00Z', 6, now)).toBe(false)
    expect(autoSyncDue('2026-10-23T03:00:00Z', 6, now)).toBe(true)
    expect(autoSyncDue(null, 0, now)).toBe(false)
  })

  it('a inizio anno sincronizza anche l’anno precedente', () => {
    expect(defaultYears(new Date('2026-01-15'))).toEqual([2025, 2026])
    expect(defaultYears(new Date('2026-10-23'))).toEqual([2026])
  })
})
