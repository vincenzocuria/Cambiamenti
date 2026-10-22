import { supabase } from '../lib/supabase'
import { debitNoteLine, type CourseInvoiceKind } from '../lib/courseInvoice'
import { computeTotals, customerDisplayName } from '../lib/fatturaPa'
import { calendarDateIso } from '../lib/studentDocumentStatus'
import { CourseLinker } from './invoiceImportCore'
import { createInvoice } from './invoices'
import { suggestPaInvoiceNumber } from './invoiceNumbering'
import type { Course, CourseReportLine, Customer, Invoice, InvoiceLine } from '../types/db'

/** Una riga di fattura (o nota di debito) collegata al corso, con i dati della fattura. */
export interface CourseInvoiceRow {
  invoice_id: string
  line_index: number
  course_id: string
  kind: CourseInvoiceKind
  amount: number | null
  invoice: Pick<
    Invoice,
    | 'id'
    | 'number'
    | 'invoice_date'
    | 'doc_type'
    | 'status'
    | 'sdi_status'
    | 'sdi_status_label'
    | 'paid_at'
    | 'total'
    | 'counterpart_name'
    | 'customer_id'
  >
  description: string
}

const INVOICE_COLUMNS =
  'id, number, invoice_date, doc_type, status, sdi_status, sdi_status_label, paid_at, total, counterpart_name, customer_id, lines'

type RawRow = Omit<CourseInvoiceRow, 'invoice' | 'description' | 'amount'> & {
  amount: number | string | null
  invoices: (CourseInvoiceRow['invoice'] & { lines: InvoiceLine[] }) | null
}

function fromRaw(r: RawRow): CourseInvoiceRow | null {
  if (!r.invoices) return null
  const { lines, ...invoice } = r.invoices
  return {
    invoice_id: r.invoice_id,
    line_index: r.line_index,
    course_id: r.course_id,
    kind: r.kind,
    amount: r.amount == null ? null : Number(r.amount),
    invoice: { ...invoice, total: invoice.total == null ? null : Number(invoice.total) },
    description: Array.isArray(lines) ? (lines[r.line_index]?.description ?? '') : '',
  }
}

/** Fatture e note di debito che riguardano i corsi indicati, dalla più recente. */
export async function listCourseInvoices(courseIds: string[]): Promise<CourseInvoiceRow[]> {
  if (!courseIds.length) return []
  const { data, error } = await supabase
    .from('invoice_courses')
    .select(`invoice_id, line_index, course_id, kind, amount, invoices (${INVOICE_COLUMNS})`)
    .in('course_id', courseIds)
  if (error) throw error
  return ((data ?? []) as unknown as RawRow[])
    .map(fromRaw)
    .filter((r): r is CourseInvoiceRow => r != null)
    .sort(
      (a, b) =>
        (b.invoice.invoice_date ?? '9999').localeCompare(a.invoice.invoice_date ?? '9999') ||
        a.line_index - b.line_index,
    )
}

/** Ricollega ai corsi le righe di una fattura (dopo averla salvata). */
export async function relinkInvoiceCourses(invoiceId: string, lines: InvoiceLine[]): Promise<number> {
  return new CourseLinker(supabase).link(invoiceId, lines)
}

/** Ente a cui intestare la nota: quello delle note già collegate ai corsi, altrimenti la Regione. */
async function findRegionCustomer(): Promise<Customer | null> {
  const { data: linked, error } = await supabase
    .from('invoice_courses')
    .select('invoices (customer_id, invoice_date)')
    .limit(200)
  if (error) throw error
  const ids = ((linked ?? []) as unknown as { invoices: { customer_id: string | null; invoice_date: string | null } | null }[])
    .map((r) => r.invoices)
    .filter((i): i is { customer_id: string; invoice_date: string | null } => !!i?.customer_id)
    .sort((a, b) => (b.invoice_date ?? '').localeCompare(a.invoice_date ?? ''))
  if (ids.length) {
    const { data, error: e2 } = await supabase.from('customers').select('*').eq('id', ids[0].customer_id).maybeSingle()
    if (e2) throw e2
    if (data) return data as Customer
  }
  const { data, error: e3 } = await supabase
    .from('customers')
    .select('*')
    .ilike('company_name', '%regione%')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (e3) throw e3
  return (data as Customer | null) ?? null
}

/** Descrizione di una nota precedente con lo stesso CUP, da usare come modello del testo. */
async function templateFor(course: Course, kind: CourseInvoiceKind): Promise<string | null> {
  const rows = await listCourseInvoices([course.id])
  const same = rows.find((r) => r.kind === kind) ?? rows[0]
  if (same?.description) return same.description
  if (!course.cup) return null
  const { data, error } = await supabase.from('courses').select('id').eq('cup', course.cup)
  if (error) throw error
  const others = await listCourseInvoices((data ?? []).map((c) => c.id as string))
  return (others.find((r) => r.kind === kind) ?? others[0])?.description ?? null
}

export interface DebitNoteItem {
  course: Course
  report: CourseReportLine | null
  amount: number
}

/**
 * Crea la bozza della nota di debito (TD05, esente art. 10) alla Regione con una riga per corso,
 * la collega ai corsi e restituisce l'id per aprirla in Fatturazione.
 */
export async function createDebitNote(kind: CourseInvoiceKind, items: DebitNoteItem[]): Promise<string> {
  if (!items.length) throw new Error('Scegli almeno un corso')
  const customer = await findRegionCustomer()
  const lines: InvoiceLine[] = []
  for (const item of items) {
    const template = await templateFor(item.course, kind)
    lines.push(debitNoteLine(item.course, kind, item.amount, item.report, template))
  }
  const date = calendarDateIso()
  const totals = computeTotals(lines, null)
  const number = await suggestPaInvoiceNumber(Number(date.slice(0, 4))).catch(() => '')
  const invoice = await createInvoice({
    direction: 'out',
    status: 'draft',
    doc_type: 'TD05',
    number,
    invoice_date: date,
    customer_id: customer?.id ?? null,
    counterpart_name: customer ? customerDisplayName(customer) : '',
    counterpart_vat: customer?.vat_number ?? '',
    counterpart_tax_code: customer?.tax_code ?? '',
    taxable: totals.taxable,
    vat_amount: totals.vat,
    stamp: null,
    total: totals.total,
    payment_method: 'bonifico',
    payment_due: date,
    causale: '',
    lines,
    notes: '',
  })
  await relinkInvoiceCourses(invoice.id, lines)
  return invoice.id
}

/** Corsi collegati alle righe di una fattura. */
export async function listInvoiceCourses(
  invoiceId: string,
): Promise<{ line_index: number; kind: CourseInvoiceKind; amount: number | null; course: Pick<Course, 'id' | 'name' | 'edition' | 'code'> }[]> {
  const { data, error } = await supabase
    .from('invoice_courses')
    .select('line_index, kind, amount, courses (id, name, edition, code)')
    .eq('invoice_id', invoiceId)
    .order('line_index')
  if (error) throw error
  type Raw = { line_index: number; kind: CourseInvoiceKind; amount: number | string | null; courses: Pick<Course, 'id' | 'name' | 'edition' | 'code'> | null }
  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.courses)
    .map((r) => ({ line_index: r.line_index, kind: r.kind, amount: r.amount == null ? null : Number(r.amount), course: r.courses! }))
}
