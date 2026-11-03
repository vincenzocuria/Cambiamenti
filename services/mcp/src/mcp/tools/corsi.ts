import { z } from 'zod'
import { summarizeCoursePayments, type PaymentsInvoiceLine, type PaymentsStaffRow } from '../../../../../src/lib/paymentsSummary'
import type { CoursePayment, CourseReportLine } from '../../../../../src/types/db'
import { dbError } from '../db'
import { courseIter } from '../iter'
import { one, text, wordsFilter, type McpCtx } from '../context'

export const COURSE_STATUSES = ['bozza', 'in_creazione', 'in_attivazione', 'in_corso', 'finito', 'rendicontato', 'esito_chiuso'] as const

const COURSE_LIST_COLUMNS = 'id, name, edition, code, cup, status, start_date, end_date, duration_hours, funding_program, funding_decree'

type Person = { id: string; first_name: string; last_name: string }
type InvoiceRef = {
  id: string
  number: string | null
  invoice_date: string | null
  doc_type: string
  status: string
  direction: string
  total: number | null
  paid_at: string | null
  sdi_status_label: string | null
}

export function registerCourseTools({ server, db }: McpCtx): void {
  server.registerTool(
    'cerca_corsi',
    {
      description:
        "Cerca i corsi del gestionale per nome, edizione, ID corso (es. 673.7) o CUP, con filtri per stato e periodo. Restituisce l'elenco sintetico: per il dettaglio usa scheda_corso.",
      inputSchema: z.object({
        testo: z.string().optional().describe('Parte di nome, edizione, ID corso o CUP'),
        stato: z.enum(COURSE_STATUSES).optional(),
        dal: z.string().optional().describe('Corsi che finiscono da questa data in poi (AAAA-MM-GG)'),
        al: z.string().optional().describe('Corsi che iniziano entro questa data (AAAA-MM-GG)'),
        limite: z.number().int().min(1).max(200).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ testo, stato, dal, al, limite }) => {
      let query = db.from('courses').select(COURSE_LIST_COLUMNS).order('start_date', { ascending: false, nullsFirst: false }).limit(limite ?? 50)
      const filter = testo ? wordsFilter(testo, ['name', 'edition', 'code', 'cup']) : null
      if (filter) query = query.or(filter)
      if (stato) query = query.eq('status', stato)
      if (dal) query = query.gte('end_date', dal)
      if (al) query = query.lte('start_date', al)
      const { data, error } = await query
      if (error) throw dbError(error, 'Ricerca corsi')
      return text({ trovati: data.length, corsi: data })
    },
  )

  server.registerTool(
    'scheda_corso',
    {
      description:
        "Scheda completa di un corso: dati, finanziamento, organico, allievi, calendario, verbali della Regione, pagamenti, note di debito/fatture, documenti, ultime modifiche fatte da Claude e l'iter dal bando alla chiusura con il prossimo passo.",
      inputSchema: z.object({ id: z.string().uuid().describe('ID del corso (da cerca_corsi)') }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const [course, staff, students, lessons, payments, reports, invoices, docLinks, auditRows] = await Promise.all([
        db.from('courses').select('*').eq('id', id).maybeSingle(),
        db.from('course_staff').select('person_id, role, modules, hours, hourly_rate, people(id, first_name, last_name)').eq('course_id', id),
        db.from('course_students').select('students(id, first_name, last_name, tax_code)').eq('course_id', id),
        db.from('calendar_events').select('starts_at, ends_at').eq('course_id', id).order('starts_at'),
        db.from('course_payments').select('*').eq('course_id', id).order('paid_on', { ascending: false }),
        db.from('course_report_lines').select('*').eq('course_id', id),
        db
          .from('invoice_courses')
          .select('kind, amount, line_index, invoices(id, number, invoice_date, doc_type, status, direction, total, paid_at, sdi_status_label)')
          .eq('course_id', id),
        db.from('document_courses').select('documents(id, title, category, file_name, mime_type, created_at)').eq('course_id', id),
        db.from('mcp_audit_log').select('tool, summary, created_at').eq('course_id', id).order('created_at', { ascending: false }).limit(20),
      ])
      if (course.error) throw dbError(course.error, 'Lettura corso')
      if (!course.data) throw new Error('Corso non trovato')
      for (const [res, what] of [
        [staff, 'organico'],
        [students, 'allievi'],
        [lessons, 'calendario'],
        [payments, 'pagamenti'],
        [reports, 'verbali'],
        [invoices, 'fatture'],
        [docLinks, 'documenti'],
      ] as const) {
        if (res.error) throw dbError(res.error, `Lettura ${what}`)
      }
      const c = course.data as Record<string, unknown> & { id: string; name: string; edition: string; status: string }

      const staffRows: PaymentsStaffRow[] = (staff.data ?? []).map((s) => {
        const p = one(s.people as Person | Person[] | null)
        return {
          course_id: id,
          person_id: s.person_id as string,
          role: s.role as PaymentsStaffRow['role'],
          hours: s.hours == null ? null : Number(s.hours),
          hourly_rate: s.hourly_rate == null ? null : Number(s.hourly_rate),
          first_name: p?.first_name ?? '',
          last_name: p?.last_name ?? '',
        }
      })
      const invoiceRows = (invoices.data ?? []).map((r) => ({ ...r, invoice: one(r.invoices as InvoiceRef | InvoiceRef[] | null) }))
      const invoiceLines: PaymentsInvoiceLine[] = invoiceRows
        .filter((r) => r.invoice?.direction === 'out')
        .map((r) => ({
          course_id: id,
          kind: r.kind as string,
          amount: r.amount == null ? null : Number(r.amount),
          doc_type: r.invoice!.doc_type,
          status: r.invoice!.status,
          paid_at: r.invoice!.paid_at,
        }))
      const reportLines = (reports.data ?? []) as CourseReportLine[]
      const [summary] = summarizeCoursePayments(
        [{ id, name: c.name, edition: c.edition, status: c.status as never }],
        reportLines,
        staffRows,
        (payments.data ?? []) as CoursePayment[],
        invoiceLines,
      )

      const lessonRows = lessons.data ?? []
      const lessonHours = lessonRows.reduce((acc, l) => {
        const ms = Date.parse(l.ends_at as string) - Date.parse(l.starts_at as string)
        return acc + (Number.isFinite(ms) && ms > 0 ? ms / 3_600_000 : 0)
      }, 0)
      const documents = (docLinks.data ?? []).map((d) => one(d.documents)).filter(Boolean)
      const studentList = (students.data ?? []).map((s) => one(s.students)).filter(Boolean)

      const iter = courseIter({
        status: c.status,
        cup: (c.cup as string | null) ?? null,
        code: (c.code as string | null) ?? null,
        funding_program: (c.funding_program as string | null) ?? null,
        funding_decree: (c.funding_decree as string | null) ?? null,
        start_date: (c.start_date as string | null) ?? null,
        end_date: (c.end_date as string | null) ?? null,
        duration_hours: c.duration_hours == null ? null : Number(c.duration_hours),
        staff: staffRows.length,
        students: studentList.length,
        lessons: lessonRows.length,
        reportLines: reportLines.length,
        balanceToReceive: summary.report ? summary.balanceToReceive : null,
        documents: documents.length,
      })

      return text({
        corso: c,
        iter,
        organico: (staff.data ?? []).map((s) => ({
          persona: one(s.people as Person | Person[] | null),
          ruolo: s.role,
          moduli: s.modules,
          ore: s.hours,
          compenso_orario: s.hourly_rate,
        })),
        allievi: { totale: studentList.length, elenco: studentList },
        calendario: {
          lezioni: lessonRows.length,
          ore_totali: Math.round(lessonHours * 100) / 100,
          prima: lessonRows[0]?.starts_at ?? null,
          ultima: lessonRows.at(-1)?.ends_at ?? null,
        },
        economico: {
          riconosciuto: summary.recognized,
          anticipo: summary.advance,
          saldo_verbale: summary.balance,
          incassato: summary.received,
          saldo_da_incassare: summary.balanceToReceive,
          indennita_da_incassare: summary.allowanceToReceive,
          totale_da_ricevere: summary.toReceive,
          compensi_previsti: summary.staffPlanned,
          compensi_pagati: summary.staffPaid,
          compensi_da_pagare: summary.staffToPay,
          incarichi_senza_ore_o_tariffa: summary.staffMissingRate,
        },
        verbali_regione: reportLines,
        pagamenti: payments.data,
        note_di_debito_e_fatture: invoiceRows.map((r) => ({ tipo_riga: r.kind, importo: r.amount, documento: r.invoice })),
        documenti: documents,
        modifiche_da_claude: auditRows.error ? [] : auditRows.data,
      })
    },
  )
}
