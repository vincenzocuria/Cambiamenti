/** Parser ICS minimale (VEVENT) per export calendario JForma. */

export interface ParsedIcsEvent {
  external_uid: string
  title: string
  starts_at: string
  ends_at: string
  room: string
  notes: string
}

export function parseIcsCalendar(text: string): ParsedIcsEvent[] {
  const unfolded = unfoldIcs(text)
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1)
  const events: ParsedIcsEvent[] = []

  for (const block of blocks) {
    const chunk = block.split('END:VEVENT')[0] ?? ''
    const fields = parseIcsFields(chunk)
    const title = fields.get('SUMMARY') ?? ''
    const startRaw = fields.get('DTSTART') ?? ''
    const endRaw = fields.get('DTEND') ?? fields.get('DTSTART') ?? ''
    const starts_at = parseIcsDateTime(startRaw)
    const ends_at = parseIcsDateTime(endRaw)
    if (!title || !starts_at) continue

    const uid = fields.get('UID') ?? ''
    const external_uid = uid || `${starts_at}|${title}`

    events.push({
      external_uid,
      title,
      starts_at,
      ends_at: ends_at ?? starts_at,
      room: fields.get('LOCATION') ?? '',
      notes: fields.get('DESCRIPTION') ?? '',
    })
  }

  return events
}

function unfoldIcs(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out.join('\n')
}

function parseIcsFields(chunk: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of chunk.split('\n')) {
    if (!line.trim()) continue
    const sep = line.indexOf(':')
    if (sep < 0) continue
    const keyPart = line.slice(0, sep)
    const value = unescapeIcs(line.slice(sep + 1))
    const key = keyPart.split(';')[0]?.toUpperCase() ?? ''
    if (key) map.set(key, value)
  }
  return map
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parseIcsDateTime(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00.000Z`
  }

  const withTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(s)
  if (withTime) {
    const iso = `${withTime[1]}-${withTime[2]}-${withTime[3]}T${withTime[4]}:${withTime[5]}:${withTime[6]}${withTime[7] ? 'Z' : ''}`
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
