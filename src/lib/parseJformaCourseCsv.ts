/**
 * Tracciato CSV corsi (export JForma o foglio compatibile).
 * Colonne attese (alias): nome|titolo, edizione, codice, cup, data_inizio|inizio,
 * data_fine|fine, ore|durata, note.
 */
import { csvRowsToObjects, parseCsv } from './parseCsv'

export interface JformaCourseRow {
  name: string
  edition: string
  code: string
  cup: string
  start_date: string | null
  end_date: string | null
  duration_hours: number | null
  notes: string
}

const NAME_KEYS = ['nome', 'titolo', 'name', 'corso']
const EDITION_KEYS = ['edizione', 'edition']
const CODE_KEYS = ['codice', 'code']
const CUP_KEYS = ['cup']
const START_KEYS = ['data_inizio', 'inizio', 'start_date', 'data_inizio_corso']
const END_KEYS = ['data_fine', 'fine', 'end_date', 'data_fine_corso']
const HOURS_KEYS = ['ore', 'durata', 'duration_hours', 'ore_totali']
const NOTES_KEYS = ['note', 'notes', 'annotazioni']

export function parseJformaCourseCsv(text: string): JformaCourseRow[] {
  const objects = csvRowsToObjects(parseCsv(text))
  const rows: JformaCourseRow[] = []

  for (const obj of objects) {
    const name = pick(obj, NAME_KEYS)
    if (!name) continue

    rows.push({
      name,
      edition: pick(obj, EDITION_KEYS),
      code: pick(obj, CODE_KEYS),
      cup: pick(obj, CUP_KEYS),
      start_date: parseDate(pick(obj, START_KEYS)),
      end_date: parseDate(pick(obj, END_KEYS)),
      duration_hours: parseHours(pick(obj, HOURS_KEYS)),
      notes: pick(obj, NOTES_KEYS),
    })
  }

  return rows
}

function pick(obj: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v) return v
  }
  return ''
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (iso) return s
  const it = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (it) {
    const d = String(it[1]).padStart(2, '0')
    const m = String(it[2]).padStart(2, '0')
    return `${it[3]}-${m}-${d}`
  }
  return null
}

function parseHours(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
