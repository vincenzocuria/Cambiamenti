import type { CustomerInput } from '../types/db'
import type { ParsedParty } from './fatturaPa'
import { titleCase } from './text'

/** Pulizia dei campi dell'anagrafica clienti/fornitori (spazi, maiuscole, codici). */
export function normalizeCustomer<T extends Partial<CustomerInput>>(input: T): T {
  const out = { ...input }
  for (const key of Object.keys(out) as (keyof T)[]) {
    const v = out[key]
    if (typeof v === 'string') out[key] = v.trim() as T[keyof T]
  }
  if (typeof out.vat_number === 'string') out.vat_number = out.vat_number.toUpperCase().replace(/\s+/g, '')
  if (typeof out.tax_code === 'string') out.tax_code = out.tax_code.toUpperCase().replace(/\s+/g, '')
  if (typeof out.province === 'string') out.province = out.province.toUpperCase()
  if (typeof out.country === 'string') out.country = out.country.toUpperCase() || 'IT'
  if (typeof out.sdi_code === 'string') out.sdi_code = out.sdi_code.toUpperCase() || '0000000'
  if (typeof out.email === 'string') out.email = out.email.toLowerCase()
  if (typeof out.pec === 'string') out.pec = out.pec.toLowerCase()
  return out
}

/** Nomi scritti tutti in maiuscolo nell'XML (MARIO ROSSI) diventano Mario Rossi. */
function softTitle(value: string): string {
  return value && value === value.toUpperCase() ? titleCase(value) : value
}

/** Anagrafica da creare a partire dai dati di una fattura elettronica. */
export function customerFromParty(
  party: ParsedParty,
  extra: { sdiCode?: string; pec?: string; notes?: string } = {},
): CustomerInput {
  return normalizeCustomer({
    company_name: party.companyName,
    first_name: party.companyName ? '' : softTitle(party.firstName),
    last_name: party.companyName ? '' : softTitle(party.lastName),
    vat_number: party.vatNumber,
    tax_code: party.taxCode,
    address: party.address,
    postal_code: party.postalCode,
    city: softTitle(party.city),
    province: party.province,
    country: party.country || 'IT',
    sdi_code: extra.sdiCode || '0000000',
    pec: extra.pec ?? '',
    email: '',
    phone: '',
    notes: extra.notes ?? '',
  })
}

/** Chiave per riconoscere la stessa anagrafica: partita IVA, altrimenti codice fiscale. */
export function partyKey(p: { vat_number: string; tax_code: string }): string {
  const vat = p.vat_number.toUpperCase().replace(/\s+/g, '')
  if (vat) return `vat:${vat}`
  const tax = p.tax_code.toUpperCase().replace(/\s+/g, '')
  return tax ? `cf:${tax}` : ''
}
