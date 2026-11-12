import { parseMoodleDateTime } from './romeTime.ts'

export type FadEventKind = 'join' | 'leave' | 'end'

export interface FadLogEvent {
  /** Chiave stabile per non salvare due volte lo stesso evento. */
  key: string
  at: number
  kind: FadEventKind
  moodleUserId: number | null
  userName: string
  description: string
  ip: string
}

/** CSV con campi tra virgolette e virgolette raddoppiate. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

/**
 * Eventi BigBlueButton dal report log di Moodle (download CSV).
 * Il tipo si legge dalla descrizione, che Moodle scrive sempre in inglese.
 */
export function parseReportLog(text: string): FadLogEvent[] {
  const rows = parseCsv(text)
  if (!rows.length) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (names: string[], fallback: number) => {
    const i = header.findIndex((h) => names.some((n) => h.startsWith(n)))
    return i >= 0 ? i : fallback
  }
  const cTime = col(['data/ora', 'time'], 0)
  const cName = col(["nome completo dell'utente", 'user full name'], 1)
  const cDesc = col(['descrizione', 'description'], 6)
  const cIp = col(['indirizzo ip', 'ip address'], 8)

  const events: FadLogEvent[] = []
  const seen = new Map<string, number>()
  for (const r of rows.slice(1)) {
    const description = r[cDesc] ?? ''
    const kind = eventKind(description)
    if (!kind) continue
    const at = parseMoodleDateTime(r[cTime] ?? '')
    if (at == null) continue
    const moodleUserId = userIdFromDescription(description, kind)
    const base = `${at}|${kind}|${moodleUserId ?? r[cName]}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    events.push({
      key: `${base}|${n}`,
      at,
      kind,
      moodleUserId,
      userName: (r[cName] ?? '').trim(),
      description,
      ip: (r[cIp] ?? '').trim(),
    })
  }
  return events.sort((a, b) => a.at - b.at)
}

function eventKind(description: string): FadEventKind | null {
  if (!/bigbluebutton/i.test(description)) return null
  if (/has joined a bigbluebutton meeting/i.test(description)) return 'join'
  if (/has left a bigbluebutton meeting/i.test(description)) return 'leave'
  if (/has been forcibly ended/i.test(description)) return 'end'
  return null
}

function userIdFromDescription(description: string, kind: FadEventKind): number | null {
  const m =
    kind === 'end'
      ? description.match(/ended by the user with id '(\d+)'/i)
      : description.match(/^The user with id '(\d+)'/i)
  return m ? Number(m[1]) : null
}
