import { z } from 'zod'
import { paymentsTotals, summarizeCoursePayments, type PaymentsInvoiceLine, type PaymentsStaffRow } from '../../../../../src/lib/paymentsSummary'
import type { CoursePayment, CourseReportLine } from '../../../../../src/types/db'
import { dbError } from '../db'
import { addDays, one, text, today, wordsFilter, type McpCtx } from '../context'

// Dati anagrafici restituiti: mai IBAN né credenziali FAD.
const PERSON_COLUMNS = 'id, first_name, last_name, tax_code, email, phone, city, province, doc_type, doc_expiry_date, notes'

type CourseRef = { id: string; name: string; edition: string; status: string }

export function registerLookupTools({ server, db }: McpCtx): void {
  server.registerTool(
    'cerca_persone',
    {
      description:
        'Cerca persone per nome, cognome, codice fiscale o email. tipo=personale cerca docenti/tutor/amministrativi, tipo=allievi cerca gli allievi. Mostra anche i corsi collegati. Non restituisce IBAN né credenziali.',
      inputSchema: z.object({
        testo: z.string().min(2),
        tipo: z.enum(['personale', 'allievi', 'tutti']).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ testo, tipo = 'tutti' }) => {
      const filter = wordsFilter(testo, ['first_name', 'last_name', 'tax_code', 'email'])
      if (!filter) throw new Error('Testo di ricerca vuoto')
      const out: Record<string, unknown> = {}
      if (tipo !== 'allievi') {
        const { data, error } = await db
          .from('people')
          .select(`${PERSON_COLUMNS}, course_staff(role, courses(id, name, edition, status))`)
          .or(filter)
          .limit(30)
        if (error) throw dbError(error, 'Ricerca personale')
        out.personale = data
      }
      if (tipo !== 'personale') {
        const { data, error } = await db
          .from('students')
          .select(`${PERSON_COLUMNS}, inps_benefit, course_students(courses(id, name, edition, status))`)
          .or(filter)
          .limit(30)
        if (error) throw dbError(error, 'Ricerca allievi')
        out.allievi = data
      }
      return text(out)
    },
  )

  server.registerTool(
    'scadenze',
    {
      description:
        'Scadenze nei prossimi giorni: corsi che iniziano o finiscono, documenti di identità in scadenza (o già scaduti) di personale e allievi, fatture emesse non incassate oltre la data di pagamento.',
      inputSchema: z.object({ giorni: z.number().int().min(1).max(365).optional().describe('Finestra in giorni, predefinito 30') }),
      annotations: { readOnlyHint: true },
    },
    async ({ giorni = 30 }) => {
      const from = today()
      const to = addDays(from, giorni)
      const [starting, ending, people, students, invoices] = await Promise.all([
        db.from('courses').select('id, name, edition, status, start_date').gte('start_date', from).lte('start_date', to).order('start_date'),
        db.from('courses').select('id, name, edition, status, end_date').gte('end_date', from).lte('end_date', to).order('end_date'),
        db.from('people').select('id, first_name, last_name, doc_type, doc_expiry_date').lte('doc_expiry_date', to).order('doc_expiry_date'),
        db.from('students').select('id, first_name, last_name, doc_type, doc_expiry_date').lte('doc_expiry_date', to).order('doc_expiry_date'),
        db
          .from('invoices')
          .select('id, number, invoice_date, doc_type, counterpart_name, total, payment_due')
          .eq('direction', 'out')
          .is('paid_at', null)
          .lte('payment_due', to)
          .order('payment_due'),
      ])
      for (const res of [starting, ending, people, students, invoices]) if (res.error) throw dbError(res.error, 'Lettura scadenze')
      return text({
        periodo: { dal: from, al: to },
        corsi_che_iniziano: starting.data,
        corsi_che_finiscono: ending.data,
        documenti_personale_in_scadenza: people.data,
        documenti_allievi_in_scadenza: students.data,
        fatture_emesse_da_incassare: invoices.data,
      })
    },
  )

  server.registerTool(
    'situazione_pagamenti',
    {
      description:
        "Situazione economica come nella pagina Pagamenti: per ogni corso riconosciuto dal verbale, anticipo, saldo, incassato (anche dalle note di debito pagate su Aruba), da ricevere e compensi del personale. Senza corso_id restituisce tutti i corsi e i totali.",
      inputSchema: z.object({
        corso_id: z.string().uuid().optional(),
        solo_da_incassare: z.boolean().optional().describe('Solo i corsi con importi ancora da ricevere'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ corso_id, solo_da_incassare }) => {
      const coursesQ = db.from('courses').select('id, name, edition, status').order('name')
      const linesQ = db.from('course_report_lines').select('*')
      const staffQ = db.from('course_staff').select('course_id, person_id, role, hours, hourly_rate, people(first_name, last_name)')
      const paymentsQ = db.from('course_payments').select('*')
      const invoicesQ = db.from('invoice_courses').select('course_id, kind, amount, invoices(doc_type, status, paid_at, direction)')
      const [courses, lines, staff, payments, invoices] = await Promise.all(
        corso_id
          ? [coursesQ.eq('id', corso_id), linesQ.eq('course_id', corso_id), staffQ.eq('course_id', corso_id), paymentsQ.eq('course_id', corso_id), invoicesQ.eq('course_id', corso_id)]
          : [coursesQ, linesQ, staffQ, paymentsQ, invoicesQ],
      )
      for (const res of [courses, lines, staff, payments, invoices]) if (res.error) throw dbError(res.error, 'Lettura pagamenti')

      type Inv = { doc_type: string; status: string; paid_at: string | null; direction: string }
      const invoiceLines: PaymentsInvoiceLine[] = []
      for (const r of invoices.data ?? []) {
        const inv = one(r.invoices as Inv | Inv[] | null)
        if (!inv || inv.direction !== 'out') continue
        invoiceLines.push({
          course_id: r.course_id as string,
          kind: r.kind as string,
          amount: r.amount == null ? null : Number(r.amount),
          doc_type: inv.doc_type,
          status: inv.status,
          paid_at: inv.paid_at,
        })
      }
      type P = { first_name: string; last_name: string }
      const staffRows: PaymentsStaffRow[] = (staff.data ?? []).map((s) => {
        const p = one(s.people as P | P[] | null)
        return {
          course_id: s.course_id as string,
          person_id: s.person_id as string,
          role: s.role as PaymentsStaffRow['role'],
          hours: s.hours == null ? null : Number(s.hours),
          hourly_rate: s.hourly_rate == null ? null : Number(s.hourly_rate),
          first_name: p?.first_name ?? '',
          last_name: p?.last_name ?? '',
        }
      })
      let rows = summarizeCoursePayments(
        (courses.data ?? []) as CourseRef[] as never,
        (lines.data ?? []) as CourseReportLine[],
        staffRows,
        (payments.data ?? []) as CoursePayment[],
        invoiceLines,
      )
      if (solo_da_incassare) rows = rows.filter((r) => r.toReceive > 0)
      return text({
        totali: paymentsTotals(rows),
        corsi: rows.map((r) => ({
          corso: r.course,
          verbale: r.report ? { protocollo: r.report.protocol_number, data: r.report.protocol_date } : null,
          riconosciuto: r.recognized,
          anticipo: r.advance,
          saldo_verbale: r.balance,
          incassato: r.received,
          di_cui_da_note_di_debito: r.receivedFromInvoices,
          saldo_da_incassare: r.balanceToReceive,
          indennita_da_incassare: r.allowanceToReceive,
          totale_da_ricevere: r.toReceive,
          compensi_previsti: r.staffPlanned,
          compensi_pagati: r.staffPaid,
          compensi_da_pagare: r.staffToPay,
        })),
      })
    },
  )

  server.registerTool(
    'registro_modifiche',
    {
      description: 'Ultime modifiche fatte da Claude tramite il connettore (chi, quando, cosa).',
      inputSchema: z.object({ corso_id: z.string().uuid().optional(), limite: z.number().int().min(1).max(200).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ corso_id, limite }) => {
      let q = db.from('mcp_audit_log').select('created_at, tool, summary, course_id, args, user_id').order('created_at', { ascending: false }).limit(limite ?? 50)
      if (corso_id) q = q.eq('course_id', corso_id)
      const { data, error } = await q
      if (error) throw dbError(error, 'Lettura registro')
      return text(data)
    },
  )
}
