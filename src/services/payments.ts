import { supabase } from '../lib/supabase'
import {
  summarizeCoursePayments,
  type CoursePaymentSummary,
  type PaymentsCourse,
  type PaymentsInvoiceLine,
  type PaymentsStaffRow,
} from '../lib/paymentsSummary'
import type {
  CoursePayment,
  CoursePaymentDirection,
  CoursePaymentKind,
  CourseReportLine,
  CourseStaffRole,
} from '../types/db'

export interface PaymentsData {
  rows: CoursePaymentSummary[]
  /** false se la tabella dei pagamenti non esiste ancora (migrazione 0025 non applicata). */
  paymentsEnabled: boolean
}

type StaffQueryRow = {
  course_id: string
  person_id: string
  role: CourseStaffRole
  hours: number | null
  hourly_rate: number | null
  people: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

type InvoiceRef = { doc_type: string; status: string; paid_at: string | null; direction: string }
type InvoiceLineRow = {
  course_id: string
  kind: string
  amount: number | string | null
  invoices: InvoiceRef | InvoiceRef[] | null
}

/** Corsi con importi dei verbali, incassi dalla Regione e compensi del personale. */
export async function fetchPaymentsData(): Promise<PaymentsData> {
  const [coursesRes, linesRes, staffRes, paymentsRes, invoicesRes] = await Promise.all([
    supabase.from('courses').select('id, name, edition, status').order('name'),
    supabase.from('course_report_lines').select('*'),
    supabase
      .from('course_staff')
      .select('course_id, person_id, role, hours, hourly_rate, people(first_name, last_name)'),
    supabase.from('course_payments').select('*').order('paid_on', { ascending: false }),
    supabase
      .from('invoice_courses')
      .select('course_id, kind, amount, invoices (doc_type, status, paid_at, direction)'),
  ])
  if (coursesRes.error) throw coursesRes.error
  if (linesRes.error) throw linesRes.error
  if (staffRes.error) throw staffRes.error

  const paymentsEnabled = !paymentsRes.error
  // Note di debito collegate ai corsi: se la tabella manca, si va avanti senza
  const invoiceLines: PaymentsInvoiceLine[] = ((invoicesRes.data ?? []) as unknown as InvoiceLineRow[])
    .map((r) => {
      const inv = Array.isArray(r.invoices) ? r.invoices[0] : r.invoices
      if (!inv || inv.direction !== 'out') return null
      return {
        course_id: r.course_id,
        kind: r.kind,
        amount: r.amount == null ? null : Number(r.amount),
        doc_type: inv.doc_type,
        status: inv.status,
        paid_at: inv.paid_at,
      }
    })
    .filter((l): l is PaymentsInvoiceLine => l != null)
  const payments = (paymentsRes.data ?? []) as CoursePayment[]

  const staff: PaymentsStaffRow[] = ((staffRes.data ?? []) as StaffQueryRow[]).map((s) => {
    const person = Array.isArray(s.people) ? s.people[0] : s.people
    return {
      course_id: s.course_id,
      person_id: s.person_id,
      role: s.role,
      hours: s.hours,
      hourly_rate: s.hourly_rate,
      first_name: person?.first_name ?? '',
      last_name: person?.last_name ?? '',
    }
  })

  return {
    rows: summarizeCoursePayments(
      (coursesRes.data ?? []) as PaymentsCourse[],
      (linesRes.data ?? []) as CourseReportLine[],
      staff,
      payments,
      invoiceLines,
    ),
    paymentsEnabled,
  }
}

export interface NewCoursePayment {
  course_id: string
  direction: CoursePaymentDirection
  kind: CoursePaymentKind
  person_id?: string | null
  role?: CourseStaffRole | null
  amount: number
  paid_on: string
  reference?: string
  notes?: string
}

export async function createCoursePayment(payment: NewCoursePayment): Promise<void> {
  const { error } = await supabase.from('course_payments').insert({
    ...payment,
    person_id: payment.person_id ?? null,
    role: payment.role ?? null,
    reference: payment.reference?.trim() ?? '',
    notes: payment.notes?.trim() ?? '',
  })
  if (error) throw error
}

export async function deleteCoursePayment(id: string): Promise<void> {
  const { error } = await supabase.from('course_payments').delete().eq('id', id)
  if (error) throw error
}
