import { fmtDate } from './format'

const DAY = 24 * 60 * 60 * 1000

function parseDay(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(t) ? null : t
}

/** Avanzamento del calendario tra data di inizio e di fine. */
export function courseTimeline(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): { percent: number; label: string } | null {
  const s = parseDay(start)
  const e = parseDay(end)
  if (s == null || e == null || e < s) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const totalDays = Math.round((e - s) / DAY) + 1
  if (today < s) {
    const wait = Math.round((s - today) / DAY)
    return { percent: 0, label: `Inizia tra ${wait} ${wait === 1 ? 'giorno' : 'giorni'} (${fmtDate(start)})` }
  }
  if (today > e) return { percent: 100, label: `Lezioni concluse il ${fmtDate(end)}` }
  const day = Math.round((today - s) / DAY) + 1
  return {
    percent: Math.round((day / totalDays) * 100),
    label: `Giorno ${day} di ${totalDays} · fine il ${fmtDate(end)}`,
  }
}
