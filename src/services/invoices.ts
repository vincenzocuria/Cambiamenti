import { supabase } from '../lib/supabase'
import { parseFatturaPa } from '../lib/fatturaPa'
import { normalizeCustomer } from '../lib/customer'
import type {
  Customer,
  CustomerInput,
  Invoice,
  InvoiceDirection,
  InvoiceInput,
} from '../types/db'

/** Le colonne numeric possono arrivare come stringa: le riporta a numero. */
function fromRow(row: Invoice): Invoice {
  const n = (v: unknown) => (v == null ? null : Number(v))
  return {
    ...row,
    taxable: n(row.taxable),
    vat_amount: n(row.vat_amount),
    stamp: n(row.stamp),
    total: n(row.total),
    lines: Array.isArray(row.lines) ? row.lines : [],
  }
}

/** Elenco senza l'XML (pesante): lo si legge solo nel dettaglio. */
const LIST_COLUMNS =
  'id, direction, status, doc_type, number, invoice_date, customer_id, eipass_candidate_id, counterpart_name, counterpart_vat, counterpart_tax_code, taxable, vat_amount, stamp, total, payment_method, payment_due, causale, lines, notes, aruba_filename, sdi_id, sdi_status, sdi_status_label, created_at, updated_at'

export async function listInvoices(direction: InvoiceDirection, year: number): Promise<Invoice[]> {
  const rows: Invoice[] = []
  // Le bozze senza data compaiono sempre tra le emesse
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from('invoices')
      .select(LIST_COLUMNS)
      .eq('direction', direction)
      .order('invoice_date', { ascending: false, nullsFirst: true })
      .order('number', { ascending: false })
      .range(from, from + 999)
    query = query.or(
      `and(invoice_date.gte.${year}-01-01,invoice_date.lte.${year}-12-31),invoice_date.is.null`,
    )
    const { data, error } = await query
    if (error) throw error
    rows.push(...((data ?? []) as unknown as Invoice[]).map((r) => fromRow({ ...r, xml: null })))
    if (!data || data.length < 1000) break
  }
  return rows
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
  if (error) throw error
  return fromRow(data as Invoice)
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const { data, error } = await supabase.from('invoices').insert(input).select().single()
  if (error) throw error
  return fromRow(data as Invoice)
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<Invoice> {
  const { data, error } = await supabase.from('invoices').update(input).eq('id', id).select().single()
  if (error) throw error
  return fromRow(data as Invoice)
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('status', 'draft')
  if (error) throw error
}

/** Numeri già usati nelle fatture emesse dell'anno (per proporre il successivo). */
export async function listOutInvoiceNumbers(
  year: number,
): Promise<{ invoice_number: string; invoice_date: string | null }[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('number, invoice_date')
    .eq('direction', 'out')
    .gte('invoice_date', `${year}-01-01`)
    .lte('invoice_date', `${year}-12-31`)
  if (error) throw error
  return (data ?? []).map((r) => ({ invoice_number: r.number as string, invoice_date: r.invoice_date as string }))
}

/** Completa una fattura importata leggendo totali e righe dal suo XML. */
export async function applyParsedXml(invoice: Invoice, xml: string): Promise<Invoice> {
  const p = parseFatturaPa(xml)
  const counterpart =
    invoice.direction === 'out'
      ? { name: p.buyerName, vat: p.buyerVat, tax: p.buyerTaxCode }
      : { name: p.sellerName, vat: p.sellerVat, tax: p.sellerTaxCode }
  return updateInvoice(invoice.id, {
    xml,
    doc_type: p.docType || invoice.doc_type,
    number: p.number || invoice.number,
    invoice_date: p.date || invoice.invoice_date,
    counterpart_name: counterpart.name || invoice.counterpart_name,
    counterpart_vat: counterpart.vat || invoice.counterpart_vat,
    counterpart_tax_code: counterpart.tax || invoice.counterpart_tax_code,
    taxable: p.taxable,
    vat_amount: p.vat,
    stamp: p.stamp,
    total: p.total,
    causale: p.causale,
    payment_due: p.paymentDue || null,
    lines: p.lines,
  })
}

// ── Clienti ──────────────────────────────────────────────────────────────

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('company_name')
    .order('last_name')
    .order('first_name')
  if (error) throw error
  return data as Customer[]
}

/** Per ogni anagrafica: se compare nelle fatture emesse (cliente) e/o ricevute (fornitore). */
export async function listCustomerRoles(): Promise<Map<string, { out: boolean; in: boolean }>> {
  const roles = new Map<string, { out: boolean; in: boolean }>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('invoices')
      .select('customer_id, direction')
      .not('customer_id', 'is', null)
      .range(from, from + 999)
    if (error) throw error
    for (const r of (data ?? []) as { customer_id: string; direction: InvoiceDirection }[]) {
      const role = roles.get(r.customer_id) ?? { out: false, in: false }
      role[r.direction] = true
      roles.set(r.customer_id, role)
    }
    if (!data || data.length < 1000) break
  }
  return roles
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase.from('customers').insert(normalizeCustomer(input)).select().single()
  if (error) throw error
  return data as Customer
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(normalizeCustomer(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}
