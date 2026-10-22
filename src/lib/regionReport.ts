/**
 * Lettura dei verbali della Regione (es. «VERIFICA FINALE AMMINISTRATIVA CONTABILE»)
 * e delle autodichiarazioni: tipo di documento, protocollo, CUP e, per i verbali,
 * una riga per corso con ore, allievi, date e importi.
 */
import type { Course } from '../types/db'

export interface ReportRow {
  cup: string
  courseCode: string
  title: string
  edition: number | null
  funding: number | null
  hours: number | null
  studentsTrained: number | null
  membershipAct: string
  startDate: string | null
  endDate: string | null
  budget: number | null
  recognized: number | null
  advance: number | null
  balance: number | null
}

export type ReportKind = 'report' | 'declaration' | 'other'

export interface ParsedReport {
  kind: ReportKind
  subject: string
  protocolNumber: string
  protocolDate: string | null
  cups: string[]
  rows: ReportRow[]
  total: number | null
  warnings: string[]
}

const CUP = /\b[A-Z]\d{2}[A-Z]\d{11}\b/g
const CUP_ONE = /^[A-Z]\d{2}[A-Z]\d{11}$/
const MONEY = /^€?\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** «€ 26.123,40» → 26123.4; «-» o testo → null. */
export function parseEuro(cell: string): number | null {
  const m = MONEY.exec(cell.trim())
  if (!m) return null
  return Number(`${m[1].replace(/\./g, '')}.${m[2]}`)
}

/** «21/10/2026» → «2026-10-21». */
export function parseItDate(cell: string): string | null {
  const m = DATE.exec(cell.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const cells = (line: string) =>
  line
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter(Boolean)

const intOrNull = (cell: string | undefined) => (cell && /^\d+$/.test(cell) ? Number(cell) : null)

const cents = (n: number) => Math.round(n * 100)

const euro = (n: number) => {
  const [int, dec] = n.toFixed(2).split('.')
  return `€ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}

function emptyRow(cup: string): ReportRow {
  return {
    cup,
    courseCode: '',
    title: '',
    edition: null,
    funding: null,
    hours: null,
    studentsTrained: null,
    membershipAct: '',
    startDate: null,
    endDate: null,
    budget: null,
    recognized: null,
    advance: null,
    balance: null,
  }
}

export function parseRegionReport(lines: string[]): ParsedReport {
  const text = lines.join('\n')
  const warnings: string[] = []

  const prot = /Prot\.?\s*N\.?\s*(\d+)\s+del\s+(\d{2}\/\d{2}\/\d{4})/i.exec(text)
  const cups = [...new Set(text.match(CUP) ?? [])]

  // Tabella 1: CUP · ID corso · titolo · ED. n · finanziamento
  const courses: ReportRow[] = []
  // Tabella 2: CUP · ore aula · ore stage · allievi · ID atto · inizio · fine
  const schedule: { hours: number | null; students: number | null; act: string; start: string | null; end: string | null }[] = []
  // Tabella 3: CUP · preventivo · riconosciuto · anticipazione · decreto · saldo
  const money: { budget: number | null; recognized: number | null; advance: number | null; balance: number | null }[] = []
  let total: number | null = null

  for (let i = 0; i < lines.length; i++) {
    const c = cells(lines[i])
    const at = c.findIndex((x) => CUP_ONE.test(x))
    if (at < 0) {
      if (/^TOTALE$/i.test(c[c.length - 1] ?? '') && i + 1 < lines.length) {
        const next = parseEuro(lines[i + 1])
        if (next != null) total = next
      } else if (/^TOTALE\b/i.test(lines[i]) && c.length > 1) {
        total = parseEuro(c[c.length - 1]) ?? total
      }
      continue
    }
    const rest = c.slice(at + 1)
    const cup = c[at]
    const edIdx = rest.findIndex((x) => /^ED\.?\s*\d+$/i.test(x))
    if (edIdx >= 0 && /^\d+(\.\d+)?$/.test(rest[0] ?? '')) {
      const row = emptyRow(cup)
      row.courseCode = rest[0]
      row.title = rest.slice(1, edIdx).join(' ')
      row.edition = Number(/\d+/.exec(rest[edIdx])![0])
      row.funding = rest.slice(edIdx + 1).map(parseEuro).find((n) => n != null) ?? null
      courses.push(row)
      continue
    }
    const actIdx = rest.findIndex((x) => /^ID\s*\d+$/i.test(x))
    if (actIdx >= 0) {
      const dates = rest.slice(actIdx + 1).map(parseItDate)
      schedule.push({
        hours: intOrNull(rest[0]),
        students: intOrNull(rest[actIdx - 1]),
        act: rest[actIdx].replace(/\s+/, ' '),
        start: dates[0] ?? null,
        end: dates[1] ?? null,
      })
      continue
    }
    const amounts = rest.filter((x) => x === '-' || parseEuro(x) != null)
    if (amounts.length >= 3 && amounts.length === rest.length) {
      money.push({
        budget: parseEuro(rest[0]),
        recognized: parseEuro(rest[1]),
        advance: parseEuro(rest[2]),
        balance: parseEuro(rest[rest.length - 1]),
      })
    }
  }

  const rows = courses
  if (rows.length) {
    if (schedule.length && schedule.length !== rows.length)
      warnings.push('Le righe con ore e date non corrispondono al numero di corsi: controlla a mano.')
    if (money.length && money.length !== rows.length)
      warnings.push('Le righe degli importi non corrispondono al numero di corsi: controlla a mano.')
    rows.forEach((row, i) => {
      const s = schedule.length === rows.length ? schedule[i] : undefined
      if (s) {
        row.hours = s.hours
        row.studentsTrained = s.students
        row.membershipAct = s.act
        row.startDate = s.start
        row.endDate = s.end
      }
      const m = money.length === rows.length ? money[i] : undefined
      if (m) Object.assign(row, m)
      const label = `${row.courseCode} ED. ${row.edition ?? '?'}`
      if (row.recognized != null && row.balance != null) {
        const expected = row.recognized - (row.advance ?? 0)
        if (cents(expected) !== cents(row.balance))
          warnings.push(
            `${label}: riconosciuto ${euro(row.recognized)}${row.advance ? ` meno anticipazione ${euro(row.advance)}` : ''} ma saldo da liquidare ${euro(row.balance)}.`,
          )
      }
    })
    if (total != null) {
      const sum = rows.reduce((acc, r) => acc + (r.balance ?? 0), 0)
      if (cents(sum) !== cents(total))
        warnings.push(`La somma dei saldi (${euro(sum)}) è diversa dal totale del verbale (${euro(total)}).`)
    }
  }

  const kind: ReportKind = rows.length
    ? 'report'
    : /autodichiarazione|dichiarazione sostitutiva|DICHIARA/i.test(text)
      ? 'declaration'
      : 'other'

  let subject = ''
  if (kind === 'report') {
    const oggetto = lines.findIndex((l) => /^OGGETTO\b/i.test(l))
    const from = oggetto < 0 ? 0 : oggetto
    subject =
      lines
        .slice(from, from + 8)
        .find((l) => /^[A-ZÀ-Ü0-9 '’.,–-]{12,}$/.test(l) && !/^OGGETTO/i.test(l)) ?? ''
  } else if (kind === 'declaration') {
    const at = lines.findIndex((l) => /autodichiarazione/i.test(l))
    // il titolo può andare a capo: unisco la riga successiva se la frase non è finita
    const joined =
      at < 0
        ? 'Autodichiarazione'
        : /\b(di|del|della|dei|in|a|al|e|per|relativa|relativi)$/i.test(lines[at]) && lines[at + 1]
          ? `${lines[at]} ${lines[at + 1]}`
          : lines[at]
    subject = joined.replace(/^Allegato\s*\d*\s*[–-]\s*/i, '')
  }

  return {
    kind,
    subject: subject.trim(),
    protocolNumber: prot?.[1] ?? '',
    protocolDate: prot ? parseItDate(prot[2]) : null,
    cups,
    rows,
    total,
    warnings,
  }
}

/** Numero di edizione del corso: «ED1 - 2025» → 1, «Ed. 2» → 2, «3» → 3. */
export function courseEditionNumber(edition: string): number | null {
  const ed = /ED\.?\s*(\d+)/i.exec(edition)
  if (ed) return Number(ed[1])
  const plain = /^\s*(\d{1,2})\b/.exec(edition)
  return plain ? Number(plain[1]) : null
}

const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase()

/** Corso del gestionale per una riga del verbale: CUP + ID corso + edizione (+ data di inizio se serve). */
export function matchReportRow(row: ReportRow, courses: Course[]): Course | null {
  let found = courses.filter(
    (c) =>
      norm(c.code) === norm(row.courseCode) &&
      courseEditionNumber(c.edition) === row.edition &&
      (!row.cup || !c.cup || norm(c.cup) === row.cup),
  )
  if (found.length > 1 && row.startDate) {
    const sameStart = found.filter((c) => c.start_date === row.startDate)
    if (sameStart.length) found = sameStart
  }
  return found.length === 1 ? found[0] : null
}

/** Corsi con uno dei CUP citati (per le autodichiarazioni). */
export function coursesWithCups(cups: string[], courses: Course[]): Course[] {
  const wanted = new Set(cups.map(norm))
  return courses.filter((c) => c.cup && wanted.has(norm(c.cup)))
}

/** Differenze di date tra verbale e scheda corso, da segnalare. */
export function dateMismatches(row: ReportRow, course: Course): string[] {
  const out: string[] = []
  const it = (d: string) => d.split('-').reverse().join('/')
  if (row.startDate && course.start_date && row.startDate !== course.start_date)
    out.push(`inizio: verbale ${it(row.startDate)}, gestionale ${it(course.start_date)}`)
  if (row.endDate && course.end_date && row.endDate !== course.end_date)
    out.push(`fine: verbale ${it(row.endDate)}, gestionale ${it(course.end_date)}`)
  return out
}

/** Titolo proposto per il documento. */
export function suggestedTitle(report: ParsedReport, fileName: string): string {
  const prot = report.protocolNumber
    ? ` – Prot. ${report.protocolNumber}${report.protocolDate ? ` del ${report.protocolDate.split('-').reverse().join('/')}` : ''}`
    : ''
  if (report.kind === 'report') return `Verbale ${report.subject ? report.subject.toLowerCase() : ''}`.trim() + prot
  if (report.kind === 'declaration') {
    if (report.subject.length <= 120) return report.subject
    return `${report.subject.slice(0, 120).replace(/\s+\S*$/, '')}…`
  }
  return fileName.replace(/(\.p7m|\.m7m)+$/i, '')
}
