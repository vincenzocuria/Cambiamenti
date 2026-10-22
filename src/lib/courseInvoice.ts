/**
 * Fatture e note di debito verso la Regione collegate ai corsi: ogni riga della nota riporta
 * «ID CORSO: 673.6, ED. 2 CUP: J32E22001120001», così la si abbina al corso del gestionale.
 */
import type { Course, CourseReportLine, InvoiceLine } from '../types/db'
import { courseEditionNumber } from './regionReport'

export type CourseInvoiceKind = 'balance' | 'advance' | 'allowance' | 'other'

export const courseInvoiceKinds: { value: CourseInvoiceKind; label: string; phrase: string }[] = [
  { value: 'balance', label: 'Saldo del corso', phrase: 'Saldo' },
  { value: 'allowance', label: 'Indennità di frequenza', phrase: 'Saldo indennità di frequenza' },
  { value: 'advance', label: 'Anticipo', phrase: 'Anticipo' },
  { value: 'other', label: 'Altro', phrase: '' },
]

export function courseInvoiceKindLabel(kind: string): string {
  return courseInvoiceKinds.find((k) => k.value === kind)?.label ?? 'Altro'
}

export interface CourseRef {
  courseCode: string
  edition: number | null
  cup: string
}

export interface CourseInvoiceLink {
  line_index: number
  course_id: string
  kind: CourseInvoiceKind
  amount: number
}

const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase()

/** Riferimento al corso scritto nella descrizione di una riga, se c'è. */
export function parseCourseRef(description: string): CourseRef | null {
  const id = /ID\s*CORSO\s*:?\s*(\d+(?:\.\d+)?)(?:\s*,?\s*ED\.?\s*(\d+))?/i.exec(description)
  if (!id) return null
  const cup = /\b([A-Z]\d{2}[A-Z]\d{11})\b/.exec(description.toUpperCase())
  return { courseCode: id[1], edition: id[2] ? Number(id[2]) : null, cup: cup?.[1] ?? '' }
}

/** Cosa si fattura nella riga: l'indennità va prima del saldo («Saldo indennità di frequenza»). */
export function invoiceLineKind(description: string): CourseInvoiceKind {
  if (/indennit/i.test(description)) return 'allowance'
  if (/\b(anticip|acconto)/i.test(description)) return 'advance'
  if (/\bsaldo\b/i.test(description)) return 'balance'
  return 'other'
}

/** Corso del gestionale con quel codice ed edizione (e CUP, se entrambi lo hanno); solo se è uno. */
export function matchCourseRef(ref: CourseRef, courses: Course[]): Course | null {
  if (ref.edition == null) return null
  const found = courses.filter(
    (c) =>
      norm(c.code) === norm(ref.courseCode) &&
      courseEditionNumber(c.edition) === ref.edition &&
      (!ref.cup || !c.cup || norm(c.cup) === ref.cup),
  )
  return found.length === 1 ? found[0] : null
}

const cents = (n: number) => Math.round(n * 100) / 100

/** Righe della fattura abbinate ai corsi. */
export function courseLinksForLines(lines: InvoiceLine[], courses: Course[]): CourseInvoiceLink[] {
  const out: CourseInvoiceLink[] = []
  lines.forEach((line, index) => {
    const ref = parseCourseRef(line.description)
    const course = ref && matchCourseRef(ref, courses)
    if (!course) return
    out.push({
      line_index: index,
      course_id: course.id,
      kind: invoiceLineKind(line.description),
      amount: cents((line.quantity || 1) * (line.unit_price || 0)),
    })
  })
  return out
}

/** «ID 524» → «524». */
function actNumber(act: string): string {
  return /\d+/.exec(act)?.[0] ?? ''
}

/**
 * Riga della nota di debito per un corso. Se c'è una riga di una nota precedente con lo stesso
 * CUP ne riprende l'inizio (programma, avviso) e la chiusura (es. «FINANZIATO DALL'UNIONE EUROPEA»).
 */
export function debitNoteLine(
  course: Course,
  kind: CourseInvoiceKind,
  amount: number,
  report: Pick<CourseReportLine, 'membership_act'> | null,
  template: string | null,
): InvoiceLine {
  const phrase = courseInvoiceKinds.find((k) => k.value === kind)?.phrase ?? ''
  let prefix = course.funding_program.trim()
  let suffix = ''
  if (template) {
    const start = /\b(saldo|anticipo|acconto)\b/i.exec(template)
    if (start && start.index > 0) prefix = template.slice(0, start.index).trim()
    const end = /Prot\.?\s*N\.?\s*\d+\s*\/\s*\d+/i.exec(template) ?? /\b[A-Z]\d{2}[A-Z]\d{11}\b/.exec(template)
    if (end) suffix = template.slice(end.index + end[0].length).trim()
  }
  const edition = courseEditionNumber(course.edition)
  const act = report ? actNumber(report.membership_act) : ''
  const year = (course.start_date ?? '').slice(0, 4)
  const parts = [
    prefix,
    `${phrase} Corso ${course.name.toUpperCase()}, ID CORSO: ${course.code}${edition != null ? `, ED. ${edition}` : ''}${course.cup ? ` CUP: ${course.cup}` : ''}`.trim(),
    act ? ` Atto di Adesione ed Obbligo acquisito al Prot. N. ${act}${year ? `/${year}` : ''}` : '',
    suffix ? ` ${suffix}` : '',
  ]
  return {
    description: parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    quantity: 1,
    unit_price: cents(amount),
    vat_rate: 0,
    nature: 'N4',
  }
}

/** Importo proposto per la nota: il saldo dal verbale; per gli altri casi lo si scrive a mano. */
export function suggestedDebitAmount(kind: CourseInvoiceKind, report: CourseReportLine | null): number {
  if (!report) return 0
  if (kind === 'balance') return Number(report.amount_balance ?? 0)
  if (kind === 'advance') return Number(report.amount_advance ?? 0)
  return 0
}

/** Numero della nota per la PA: stessa serie dell'ultima (es. «FPA 1/26» → «FPA 2/26»). */
export function nextSeriesNumber(numbers: string[], series: string, year: number): string {
  const yy = String(year % 100).padStart(2, '0')
  const re = new RegExp(`^\\s*${series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)\\s*/\\s*(\\d{2}|\\d{4})\\s*$`, 'i')
  let max = 0
  let sample = ''
  for (const n of numbers) {
    const m = re.exec(n)
    if (!m || (m[2] !== yy && m[2] !== String(year))) continue
    if (Number(m[1]) >= max) {
      max = Number(m[1])
      sample = n.trim()
    }
  }
  if (!sample) return `${series} 1/${yy}`
  return sample.replace(/(\d+)(\s*\/)/, (_, d: string, sep: string) => `${String(max + 1).padStart(d.length, '0')}${sep}`)
}

export interface CourseInvoiceSummary {
  /** Riconosciuto dalla Regione nei verbali. */
  recognized: number
  /** Saldo da liquidare scritto nei verbali. */
  balanceDue: number
  /** Totale fatturato per il corso (note di credito sottratte, bozze escluse). */
  billed: number
  billedBalance: number
  billedAllowance: number
  /** Parte fatturata già incassata (segnata su Aruba). */
  paid: number
  /** Saldo del verbale non ancora fatturato. */
  toBill: number
  drafts: number
}

/** Quadro di fatturazione di un corso: verbali contro note di debito emesse e incassate. */
export function courseInvoiceSummary(
  rows: { kind: string; amount: number | null; invoice: { doc_type: string; status: string; paid_at: string | null } }[],
  reports: Pick<CourseReportLine, 'amount_recognized' | 'amount_balance'>[],
): CourseInvoiceSummary {
  const recognized = reports.reduce((n, r) => n + Number(r.amount_recognized ?? 0), 0)
  const balanceDue = reports.reduce((n, r) => n + Number(r.amount_balance ?? 0), 0)
  let billed = 0
  let billedBalance = 0
  let billedAllowance = 0
  let paid = 0
  let drafts = 0
  for (const r of rows) {
    if (r.invoice.status === 'draft') {
      drafts++
      continue
    }
    const amount = Number(r.amount ?? 0) * (r.invoice.doc_type === 'TD04' ? -1 : 1)
    billed += amount
    if (r.kind === 'balance') billedBalance += amount
    if (r.kind === 'allowance') billedAllowance += amount
    if (r.invoice.paid_at) paid += amount
  }
  return {
    recognized: cents(recognized),
    balanceDue: cents(balanceDue),
    billed: cents(billed),
    billedBalance: cents(billedBalance),
    billedAllowance: cents(billedAllowance),
    paid: cents(paid),
    toBill: cents(Math.max(0, balanceDue - billedBalance)),
    drafts,
  }
}

/** Importo scritto a mano: «21.804,60», «21804,6», «21804.60» → 21804.6. */
export function parseAmountInput(value: string): number {
  const v = value.replace(/[€\s]/g, '')
  if (!v) return 0
  let n: number
  if (v.includes(',')) n = Number(v.replace(/\./g, '').replace(',', '.'))
  // Solo punti: decimale se è uno con 1-2 cifre dopo, altrimenti separatore delle migliaia
  else if (/^\d+\.\d{1,2}$/.test(v)) n = Number(v)
  else n = Number(v.replace(/\./g, ''))
  return Number.isFinite(n) ? cents(n) : 0
}

/** Importo da mostrare nel campo: «21804,60». */
export function formatAmountInput(n: number): string {
  return n ? n.toFixed(2).replace('.', ',') : ''
}
