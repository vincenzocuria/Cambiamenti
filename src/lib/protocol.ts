/** Registro di protocollo: tipi e regole pure (numerazione, filtri, etichette). */

export type ProtocolDirection = 'uscita' | 'entrata' | 'interno'
export type ProtocolChannel = 'PEC' | 'email' | 'raccomandata' | 'a mano' | 'altro'

export interface ProtocolEntry {
  id: string
  year: number
  number: number
  entry_date: string
  direction: ProtocolDirection
  counterpart: string
  subject: string
  channel: ProtocolChannel
  external_ref: string
  notes: string
  course_id: string | null
  document_id: string | null
  pec_message_id: string | null
  cancelled_at: string | null
  cancelled_reason: string
  created_at: string
  course?: { id: string; name: string; code: string | null; edition: string | null } | null
}

export interface ProtocolInput {
  entry_date: string
  direction: ProtocolDirection
  counterpart: string
  subject: string
  channel?: ProtocolChannel
  external_ref?: string
  notes?: string
  course_id?: string | null
  document_id?: string | null
  pec_message_id?: string | null
  /** solo per allinearsi al registro precedente: altrimenti il prossimo libero */
  number?: number | null
}

export const directionLabels: Record<ProtocolDirection, string> = {
  uscita: 'In uscita',
  entrata: 'In entrata',
  interno: 'Interno',
}

export const channels: ProtocolChannel[] = ['PEC', 'email', 'raccomandata', 'a mano', 'altro']

/** «12/2026»: il numero come si scrive su lettere e PEC. */
export function protocolLabel(e: Pick<ProtocolEntry, 'number' | 'year'>): string {
  return `${e.number}/${e.year}`
}

/** Prossimo numero dell'anno (solo indicativo: quello vero lo assegna il database). */
export function nextNumber(entries: Pick<ProtocolEntry, 'number' | 'year'>[], year: number): number {
  return entries.filter((e) => e.year === year).reduce((m, e) => Math.max(m, e.number), 0) + 1
}

/** Buchi nella numerazione di un anno (numeri saltati), utili per accorgersi di errori. */
export function numberingGaps(entries: Pick<ProtocolEntry, 'number' | 'year'>[], year: number): number[] {
  const used = new Set(entries.filter((e) => e.year === year).map((e) => e.number))
  const max = Math.max(0, ...used)
  const gaps: number[] = []
  for (let n = 1; n <= max; n++) if (!used.has(n)) gaps.push(n)
  return gaps
}

export interface ProtocolFilter {
  year: number | 'tutti'
  direction: ProtocolDirection | 'tutte'
  query: string
}

function courseText(c: ProtocolEntry['course']): string {
  if (!c) return ''
  return [c.code, c.name, c.edition].filter(Boolean).join(' ')
}

export function filterProtocol(entries: ProtocolEntry[], f: ProtocolFilter): ProtocolEntry[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter((e) => {
    if (f.year !== 'tutti' && e.year !== f.year) return false
    if (f.direction !== 'tutte' && e.direction !== f.direction) return false
    if (!words.length) return true
    const hay = [protocolLabel(e), e.counterpart, e.subject, e.external_ref, e.notes, e.channel, courseText(e.course)]
      .join(' ')
      .toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Più recenti prima: anno, poi numero. */
export function sortProtocol(entries: ProtocolEntry[]): ProtocolEntry[] {
  return [...entries].sort((a, b) => b.year - a.year || b.number - a.number)
}

export function courseLabel(c: ProtocolEntry['course']): string {
  if (!c) return ''
  const name = c.edition ? `${c.name} – ${c.edition}` : c.name
  return c.code ? `${c.code} · ${name}` : name
}
