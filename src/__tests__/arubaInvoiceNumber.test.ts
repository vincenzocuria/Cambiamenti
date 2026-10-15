import { describe, expect, it } from 'vitest'
import { parseInvoiceNumber } from '../../supabase/functions/aruba-invoice/aruba'

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
