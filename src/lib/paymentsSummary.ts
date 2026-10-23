import type { CoursePayment, CourseReportLine, CourseStaffRole } from '../types/db'
import type { CourseStatus } from '../data/courseStatus'
import { formatEuro } from './euroInWords'

/** Calcolo dei KPI economici dei corsi: saldi della Regione e compensi del personale. */

export interface PaymentsCourse {
  id: string
  name: string
  edition: string
  status: CourseStatus
}

export interface PaymentsStaffRow {
  course_id: string
  person_id: string
  role: CourseStaffRole
  hours: number | null
  hourly_rate: number | null
  first_name: string
  last_name: string
}

export interface StaffPaymentLine {
  personId: string
  name: string
  role: CourseStaffRole
  hours: number | null
  hourlyRate: number | null
  /** Ore × compenso orario; null se manca uno dei due. */
  planned: number | null
  paid: number
  toPay: number
}

export interface CoursePaymentSummary {
  course: PaymentsCourse
  /** Verbale più recente del corso (null se non ancora caricato). */
  report: CourseReportLine | null
  recognized: number
  advance: number
  /** Saldo da liquidare indicato dal verbale. */
  balance: number
  /** Incassi dalla Regione registrati (anticipi + saldi + altro). */
  received: number
  /** Saldo non ancora incassato. */
  toReceive: number
  staff: StaffPaymentLine[]
  staffPlanned: number
  staffPaid: number
  staffToPay: number
  /** Incarichi senza ore o compenso orario. */
  staffMissingRate: number
  payments: CoursePayment[]
}

export interface PaymentsTotals {
  recognized: number
  balance: number
  received: number
  toReceive: number
  staffPlanned: number
  staffPaid: number
  staffToPay: number
  staffMissingRate: number
  coursesWithReport: number
  coursesToReceive: number
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Arrotonda ai centesimi per non accumulare errori di virgola mobile. */
const cents = (n: number): number => Math.round(n * 100) / 100

function latestLine(lines: CourseReportLine[]): CourseReportLine | null {
  if (lines.length === 0) return null
  return [...lines].sort((a, b) => {
    const da = a.protocol_date ?? ''
    const db = b.protocol_date ?? ''
    if (da !== db) return da < db ? 1 : -1
    return a.created_at < b.created_at ? 1 : -1
  })[0]
}

export function summarizeCoursePayments(
  courses: PaymentsCourse[],
  reportLines: CourseReportLine[],
  staffRows: PaymentsStaffRow[],
  payments: CoursePayment[],
): CoursePaymentSummary[] {
  const linesByCourse = groupBy(reportLines, (l) => l.course_id)
  const staffByCourse = groupBy(staffRows, (s) => s.course_id)
  const paymentsByCourse = groupBy(payments, (p) => p.course_id)

  return courses.map((course) => {
    const report = latestLine(linesByCourse.get(course.id) ?? [])
    const coursePayments = paymentsByCourse.get(course.id) ?? []

    const recognized = num(report?.amount_recognized)
    const advance = num(report?.amount_advance)
    const balance = report
      ? report.amount_balance != null
        ? num(report.amount_balance)
        : Math.max(0, recognized - advance)
      : 0

    const incoming = coursePayments.filter((p) => p.direction === 'in')
    const received = cents(incoming.reduce((acc, p) => acc + num(p.amount), 0))
    // L'anticipo è già fuori dal saldo del verbale: conta solo ciò che è incassato come saldo o altro
    const receivedOnBalance = incoming
      .filter((p) => p.kind !== 'anticipo')
      .reduce((acc, p) => acc + num(p.amount), 0)
    const toReceive = cents(Math.max(0, balance - receivedOnBalance))

    const outgoing = coursePayments.filter((p) => p.direction === 'out')
    const staff: StaffPaymentLine[] = (staffByCourse.get(course.id) ?? []).map((s) => {
      const hours = s.hours != null ? num(s.hours) : null
      const hourlyRate = s.hourly_rate != null ? num(s.hourly_rate) : null
      const planned = hours != null && hourlyRate != null ? cents(hours * hourlyRate) : null
      const paid = cents(
        outgoing
          .filter((p) => p.person_id === s.person_id && (p.role == null || p.role === s.role))
          .reduce((acc, p) => acc + num(p.amount), 0),
      )
      return {
        personId: s.person_id,
        name: `${s.last_name} ${s.first_name}`.trim(),
        role: s.role,
        hours,
        hourlyRate,
        planned,
        paid,
        toPay: planned != null ? cents(Math.max(0, planned - paid)) : 0,
      }
    })
    // Tutti i compensi erogati, anche a figure non più nell'organico del corso
    const totalOut = outgoing.reduce((acc, p) => acc + num(p.amount), 0)

    return {
      course,
      report,
      recognized,
      advance,
      balance,
      received,
      toReceive,
      staff,
      staffPlanned: cents(staff.reduce((acc, s) => acc + (s.planned ?? 0), 0)),
      staffPaid: cents(totalOut),
      staffToPay: cents(staff.reduce((acc, s) => acc + s.toPay, 0)),
      staffMissingRate: staff.filter((s) => s.planned == null).length,
      payments: coursePayments,
    }
  })
}

export function paymentsTotals(rows: CoursePaymentSummary[]): PaymentsTotals {
  const sum = (pick: (r: CoursePaymentSummary) => number) =>
    cents(rows.reduce((acc, r) => acc + pick(r), 0))
  return {
    recognized: sum((r) => r.recognized),
    balance: sum((r) => r.balance),
    received: sum((r) => r.received),
    toReceive: sum((r) => r.toReceive),
    staffPlanned: sum((r) => r.staffPlanned),
    staffPaid: sum((r) => r.staffPaid),
    staffToPay: sum((r) => r.staffToPay),
    staffMissingRate: rows.reduce((acc, r) => acc + r.staffMissingRate, 0),
    coursesWithReport: rows.filter((r) => r.report != null).length,
    coursesToReceive: rows.filter((r) => r.toReceive > 0).length,
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

/**
 * Importo scritto all'italiana: "1.234,56", "1234,56", "1.500" (= 1500).
 * Il punto vale come decimale solo se è unico e seguito da 1-2 cifre ("99.90").
 */
export function parseEuroInput(value: string): number | null {
  const v = value.trim().replace(/€|\s/g, '')
  if (v === '') return null
  let normalized: string
  if (v.includes(',')) normalized = v.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(v)) normalized = v
  else normalized = v.replace(/\./g, '')
  const n = Number(normalized)
  return Number.isNaN(n) ? null : n
}

export const euro = (n: number): string => `€ ${formatEuro(n)}`
