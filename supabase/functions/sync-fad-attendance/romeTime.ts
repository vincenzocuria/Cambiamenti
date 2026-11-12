/** Orari del registro Moodle: sono nel fuso di Roma, li convertiamo in istanti UTC. */

const TZ = 'Europe/Rome'

function offsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - utcMs) / 60000)
}

/** Istante UTC (ms) di un orario locale di Roma. */
export function romeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second)
  let guess = naive - offsetMinutes(naive) * 60000
  guess = naive - offsetMinutes(guess) * 60000
  return guess
}

/** Data (AAAA-MM-GG) di un istante, nel fuso di Roma. */
export function romeDay(utcMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utcMs))
}

/**
 * Data/ora come le scrive il report log di Moodle in italiano: "13/03/26, 16:00:21".
 * Accetta anche l'anno a quattro cifre e i secondi mancanti.
 */
export function parseMoodleDateTime(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return romeToUtcMs(year, Number(m[2]), Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
}
