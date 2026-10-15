import { describe, expect, it } from 'vitest'
import { deriveBankInfo, normalizeIban } from '../lib/iban'

describe('archivio banche', () => {
  it('riconosce Revolut con IBAN italiano', () => {
    const info = deriveBankInfo(normalizeIban('0366901600123456789012'))
    expect(info).toMatchObject({ valid: true, abi: '03669', bic: 'REVOITM2' })
    expect(info.bankName).toContain('Revolut')
  })

  it('riconosce Revolut con IBAN lituano', () => {
    const bban = '3250012345678901'
    let r = 0
    for (const ch of bban + '2129' + '00') r = (r * 10 + Number(ch)) % 97 // L=21, T=29
    const iban = `LT${String(98 - r).padStart(2, '0')}${bban}`
    expect(deriveBankInfo(iban)).toMatchObject({ valid: true, country: 'LT', bic: 'REVOLT21' })
  })

  it('riconosce Credito Cooperativo Mediocrati', () => {
    const info = deriveBankInfo(normalizeIban('0706280600000000123456'))
    expect(info).toMatchObject({ valid: true, abi: '07062', bankName: 'Credito Cooperativo Mediocrati' })
  })

  it('lascia invariate le banche esistenti', () => {
    expect(deriveBankInfo(normalizeIban('0306901600123456789012')).bankName).toBe('Intesa Sanpaolo')
  })
})
