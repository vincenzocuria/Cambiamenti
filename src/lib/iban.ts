import { lookupAbi } from '../data/banks'

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

// Validazione ISO 7064 MOD 97-10
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith('IT') && iban.length !== 27) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const digits = ch >= '0' && ch <= '9' ? ch : String(ch.charCodeAt(0) - 55)
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97
  }
  return remainder === 1
}

export interface IbanInfo {
  valid: boolean
  country: string
  abi?: string
  cab?: string
  bankName?: string
  bic?: string
}

// Da un IBAN italiano ricava ABI/CAB e, se in archivio, banca e BIC
export function deriveBankInfo(raw: string): IbanInfo {
  const iban = normalizeIban(raw)
  const valid = isValidIban(iban)
  const country = iban.slice(0, 2)
  if (!valid || country !== 'IT') return { valid, country }
  const abi = iban.slice(5, 10)
  const cab = iban.slice(10, 15)
  const bank = lookupAbi(abi)
  return { valid: true, country, abi, cab, bankName: bank?.name, bic: bank?.bic }
}
