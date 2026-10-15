import { describe, expect, it } from 'vitest'
import { parseInvoiceNumber } from '../../supabase/functions/aruba-invoice/aruba'
import { formatInvoiceNumber, nextInvoiceNumber } from '../lib/eipassInvoice'

describe('numero fattura Aruba', () => {
  it.each([
    ['44', 44],
    ['44/2026', 44],
    ['FPR 44/26', 44],
    ['2026/44', 44],
    ['FT-0044', 44],
  ])('%s → %i', (raw, expected) => {
    expect(parseInvoiceNumber(raw, 2026)).toBe(expected)
  })

  it('ignora numeri vuoti', () => {
    expect(parseInvoiceNumber('', 2026)).toBeNull()
  })
})

describe('numerazione nello stesso formato di Aruba', () => {
  it.each([
    [45, null, '45'],
    [45, '44', '45'],
    [45, 'FPR 44/26', 'FPR 45/26'],
    [45, '2026/044', '2026/045'],
    [45, '44/2026', '45/2026'],
  ])('%d con esempio %s → %s', (n, sample, expected) => {
    expect(formatInvoiceNumber(n, 2026, sample)).toBe(expected)
  })

  it('il progressivo locale ignora prefisso e anno', () => {
    expect(nextInvoiceNumber([{ invoice_number: 'FPR 44/26', invoice_date: '2026-10-01' }], 2026)).toBe('45')
  })
})
