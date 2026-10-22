import { describe, expect, it } from 'vitest'
import {
  courseInvoiceSummary,
  courseLinksForLines,
  debitNoteLine,
  invoiceLineKind,
  formatAmountInput,
  nextSeriesNumber,
  parseAmountInput,
  parseCourseRef,
} from '../lib/courseInvoice'
import type { Course, InvoiceLine } from '../types/db'

const real =
  'Programma Garanzia Occupabilità dei Lavoratori (GOL) Avviso Pubblico n. 2 approvato con D.D. n. 12439 del 17/10/2022 Saldo indennità di frequenza Corso EIPASS PROGRESSIVE, ID CORSO: 673.6, ED. 2 CUP: J32E22001120001  Atto di Adesione ed Obbligo acquisito al Prot. N. 383/2025  FINANZIATO DALLUNIONE EUROPEA  NEXTGENERATIONEU'

function course(over: Partial<Course>): Course {
  return {
    id: 'c',
    name: 'Eipass Progressive',
    edition: 'ED2 - 2025',
    code: '673.6',
    cup: 'J32E22001120001',
    notes: '',
    status: 'rendicontato',
    start_date: '2025-11-03',
    end_date: '2025-12-05',
    duration_hours: null,
    funding_decree: '',
    funding_program: '',
    moodle_course_id: null,
    moodle_bbb_id: null,
    moodle_shortname: '',
    created_at: '',
    updated_at: '',
    ...over,
  }
}

const line = (description: string, unit_price = 100): InvoiceLine => ({
  description,
  quantity: 1,
  unit_price,
  vat_rate: 0,
  nature: 'N4',
})

describe('note di debito collegate ai corsi', () => {
  it('legge ID corso, edizione e CUP dalla riga', () => {
    expect(parseCourseRef(real)).toEqual({ courseCode: '673.6', edition: 2, cup: 'J32E22001120001' })
    expect(parseCourseRef('Corso di inglese')).toBeNull()
  })

  it('riconosce la voce: indennità prima del saldo', () => {
    expect(invoiceLineKind(real)).toBe('allowance')
    expect(invoiceLineKind('Saldo Corso X, ID CORSO: 1')).toBe('balance')
    expect(invoiceLineKind('Anticipo corso')).toBe('advance')
    expect(invoiceLineKind('Formazione')).toBe('other')
  })

  it('abbina ogni riga al suo corso per codice, edizione e CUP', () => {
    const ed1 = course({ id: 'ed1', edition: 'ED1 - 2025' })
    const ed2 = course({ id: 'ed2', edition: 'ED2 - 2025' })
    const other = course({ id: 'x', code: '673.7', edition: 'ED2 - 2025' })
    const links = courseLinksForLines([line('Senza corso'), line(real, 7770)], [ed1, ed2, other])
    expect(links).toEqual([{ line_index: 1, course_id: 'ed2', kind: 'allowance', amount: 7770 }])
  })

  it('non abbina se il CUP è diverso', () => {
    const c = course({ id: 'ed2', cup: 'J34D25003420007' })
    expect(courseLinksForLines([line(real)], [c])).toEqual([])
  })

  it('scrive la riga della nota riprendendo il testo di una nota precedente', () => {
    const c = course({ id: 'ed1', edition: 'ED1 - 2025' })
    const l = debitNoteLine(c, 'balance', 21616.5, { membership_act: 'ID 382' }, real)
    expect(l.description).toBe(
      'Programma Garanzia Occupabilità dei Lavoratori (GOL) Avviso Pubblico n. 2 approvato con D.D. n. 12439 del 17/10/2022 Saldo Corso EIPASS PROGRESSIVE, ID CORSO: 673.6, ED. 1 CUP: J32E22001120001 Atto di Adesione ed Obbligo acquisito al Prot. N. 382/2025 FINANZIATO DALLUNIONE EUROPEA NEXTGENERATIONEU',
    )
    expect(l).toMatchObject({ unit_price: 21616.5, vat_rate: 0, nature: 'N4', quantity: 1 })
    // La riga generata si ricollega allo stesso corso
    expect(courseLinksForLines([l], [c])[0]).toMatchObject({ course_id: 'ed1', kind: 'balance' })
  })

  it('propone il numero nella serie FPA dell\'anno', () => {
    expect(nextSeriesNumber(['FPR 25/26', 'FPA 1/26', 'FPA 1/25'], 'FPA', 2026)).toBe('FPA 2/26')
    expect(nextSeriesNumber(['FPR 25/26'], 'FPA', 2026)).toBe('FPA 1/26')
  })

  it('fa il quadro tra verbale, fatturato e incassato', () => {
    const inv = (doc_type: string, status: string, paid_at: string | null) => ({ doc_type, status, paid_at })
    const s = courseInvoiceSummary(
      [
        { kind: 'balance', amount: 20000, invoice: inv('TD05', 'imported', '2026-09-01') },
        { kind: 'allowance', amount: 7770, invoice: inv('TD05', 'imported', null) },
        { kind: 'balance', amount: 1000, invoice: inv('TD05', 'draft', null) },
        { kind: 'balance', amount: 500, invoice: inv('TD04', 'imported', null) },
      ],
      [{ amount_recognized: 21804.6, amount_balance: 21804.6 }],
    )
    expect(s).toMatchObject({
      recognized: 21804.6,
      billed: 27270,
      billedBalance: 19500,
      billedAllowance: 7770,
      paid: 20000,
      toBill: 2304.6,
      drafts: 1,
    })
  })

  it('legge gli importi scritti a mano e quelli proposti dal verbale', () => {
    expect(parseAmountInput(formatAmountInput(21804.6))).toBe(21804.6)
    expect(parseAmountInput('21.804,60')).toBe(21804.6)
    expect(parseAmountInput('21804.6')).toBe(21804.6)
    expect(parseAmountInput('21.804')).toBe(21804)
    expect(parseAmountInput('€ 7.770')).toBe(7770)
    expect(parseAmountInput('')).toBe(0)
  })
})
