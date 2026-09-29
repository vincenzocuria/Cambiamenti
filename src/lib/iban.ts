import { lookupAbi } from '../data/banks'

/** Contributo posizioni dispari (1-based) su ABI+CAB+conto, algoritmo BBAN ABI. */
const ITALIAN_ODD_CONTRIB = [
  1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
]

function compactIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

function ibanMod97(rearranged: string): number {
  let remainder = 0
  for (const ch of rearranged) {
    const digits = ch >= '0' && ch <= '9' ? ch : String(ch.charCodeAt(0) - 55)
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97
  }
  return remainder
}

function italianCharCode(ch: string): number {
  if (ch >= '0' && ch <= '9') return Number(ch)
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 65
  return -1
}

/** CIN da 22 caratteri ABI+CAB+conto (senza CIN in testa). */
function italianCinFromBbanBody(body22: string): string {
  let sum = 0
  for (let pos = 1; pos <= 22; pos++) {
    const code = italianCharCode(body22[pos - 1]!)
    if (code < 0) return ''
    if (pos % 2 === 1) sum += ITALIAN_ODD_CONTRIB[code] ?? 0
    else sum += code
  }
  return String.fromCharCode(65 + (sum % 26))
}

function italianIbanCheckDigits(bban23: string): string {
  return String(98 - ibanMod97(bban23 + 'IT00')).padStart(2, '0')
}

function tryCompleteItalianIban(compact: string): string | null {
  if (compact.startsWith('IT')) return null

  if (/^[A-Z][0-9]{10}[0-9A-Z]{12}$/.test(compact)) {
    const iban = `IT${italianIbanCheckDigits(compact)}${compact}`
    return isValidIbanCompact(iban) ? iban : null
  }

  if (/^[0-9]{22}$/.test(compact)) {
    const cin = italianCinFromBbanBody(compact)
    if (!cin) return null
    const bban = cin + compact
    const iban = `IT${italianIbanCheckDigits(bban)}${bban}`
    return isValidIbanCompact(iban) ? iban : null
  }

  return null
}

function isValidIbanCompact(iban: string): boolean {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith('IT') && iban.length !== 27) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  return ibanMod97(rearranged) === 1
}

export function normalizeIban(raw: string): string {
  const compact = compactIban(raw)
  if (isValidIbanCompact(compact)) return compact
  const completed = tryCompleteItalianIban(compact)
  return completed ?? compact
}

// Validazione ISO 7064 MOD 97-10
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  return isValidIbanCompact(iban)
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
  const valid = isValidIbanCompact(iban)
  const country = iban.slice(0, 2)
  if (!valid || country !== 'IT') return { valid, country }
  const abi = iban.slice(5, 10)
  const cab = iban.slice(10, 15)
  const bank = lookupAbi(abi)
  return { valid: true, country, abi, cab, bankName: bank?.name, bic: bank?.bic }
}
