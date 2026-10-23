import { describe, expect, it } from 'vitest'
import { parseEuroInput, paymentsTotals, summarizeCoursePayments } from '../lib/paymentsSummary'
import type { CoursePayment, CourseReportLine } from '../types/db'

const course = { id: 'c1', name: 'Eipass', edition: 'ED1 - 2025', status: 'rendicontato' as const }

const line = (over: Partial<CourseReportLine>): CourseReportLine => ({
  id: 'l1',
  document_id: 'd1',
  course_id: 'c1',
  subject: '',
  protocol_number: '',
  protocol_date: '2026-10-21',
  report_course_code: '',
  report_edition: '',
  membership_act: '',
  students_trained: null,
  start_date: null,
  end_date: null,
  amount_budget: null,
  amount_recognized: 26051.4,
  amount_advance: null,
  amount_balance: 26051.4,
  created_at: '2026-10-22T00:00:00Z',
  ...over,
})

const pay = (over: Partial<CoursePayment>): CoursePayment => ({
  id: Math.random().toString(),
  course_id: 'c1',
  direction: 'in',
  kind: 'saldo',
  person_id: null,
  role: null,
  amount: 0,
  paid_on: '2026-10-22',
  reference: '',
  notes: '',
  created_at: '',
  ...over,
})

const staff = [
  { course_id: 'c1', person_id: 'p1', role: 'teacher' as const, hours: 20, hourly_rate: 50, first_name: 'Anna', last_name: 'Rossi' },
  { course_id: 'c1', person_id: 'p2', role: 'tutor' as const, hours: null, hourly_rate: null, first_name: 'Luca', last_name: 'Bianchi' },
]

describe('summarizeCoursePayments', () => {
  it('saldo da ricevere e compensi da erogare', () => {
    const [row] = summarizeCoursePayments(
      [course],
      [line({}), line({ id: 'old', protocol_date: '2026-01-01', amount_balance: 1 })],
      staff,
      [
        pay({ amount: 10000 }),
        pay({ kind: 'anticipo', amount: 500 }),
        pay({ direction: 'out', kind: 'compenso', person_id: 'p1', role: 'teacher', amount: 400 }),
      ],
    )
    expect(row.balance).toBe(26051.4)
    expect(row.received).toBe(10500)
    expect(row.toReceive).toBe(16051.4)
    expect(row.staffPlanned).toBe(1000)
    expect(row.staffPaid).toBe(400)
    expect(row.staffToPay).toBe(600)
    expect(row.staffMissingRate).toBe(1)

    const t = paymentsTotals([row])
    expect(t.coursesToReceive).toBe(1)
    expect(t.toReceive).toBe(16051.4)
  })

  it('conta le note di debito incassate su Aruba e le indennità da incassare', () => {
    const inv = (kind: string, amount: number, paid_at: string | null, doc_type = 'TD05', status = 'imported') => ({
      course_id: 'c1', kind, amount, doc_type, status, paid_at,
    })
    const [row] = summarizeCoursePayments([course], [line({})], [], [pay({ amount: 1000 })], [
      inv('balance', 20000, '2026-10-20'),
      inv('balance', 51.4, null),
      inv('allowance', 7017.5, null),
      inv('allowance', 999, null, 'TD05', 'draft'),
      inv('advance', 300, '2026-03-01'),
    ])
    expect(row.received).toBe(21300)
    expect(row.receivedFromInvoices).toBe(20300)
    expect(row.allowanceToReceive).toBe(7017.5)
    // 26051,40 − 1000 − 20000 = 5051,40 di saldo + 7017,50 di indennità
    expect(row.toReceive).toBe(12068.9)
  })

  it('corso senza verbale non ha nulla da ricevere', () => {
    const [row] = summarizeCoursePayments([course], [], [], [])
    expect(row.report).toBeNull()
    expect(row.toReceive).toBe(0)
  })
})

describe('parseEuroInput', () => {
  it('formati italiani e con punto decimale', () => {
    expect(parseEuroInput('1.234,56')).toBe(1234.56)
    expect(parseEuroInput('€ 250,5')).toBe(250.5)
    expect(parseEuroInput('99.90')).toBe(99.9)
    expect(parseEuroInput('1.500')).toBe(1500)
    expect(parseEuroInput('25.849')).toBe(25849)
    expect(parseEuroInput('1.234.567')).toBe(1234567)
    expect(parseEuroInput('')).toBeNull()
  })
})
