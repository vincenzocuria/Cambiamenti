import { normalizeIban } from './iban'
import { normalizeEmail } from './roles'
import { cleanText, titleCase, upperCode } from './text'
import type { PersonInput } from '../types/db'

/** Campi anagrafica in Title Case (nome, luoghi, banca…). */
const titleFields = [
  'first_name',
  'last_name',
  'birth_place',
  'address',
  'city',
  'bank_name',
  'doc_issued_by',
] as const satisfies readonly (keyof PersonInput)[]

/** Codici formali in MAIUSCOLO. */
const upperFields = ['tax_code', 'province', 'bic', 'doc_number'] as const satisfies readonly (keyof PersonInput)[]

/** Email in minuscolo. */
const emailFields = ['email', 'fad_email'] as const satisfies readonly (keyof PersonInput)[]

/**
 * Normalizza l'input persona prima di insert/update.
 * Title Case per testi, UPPER per codici, email lower, IBAN standard.
 */
export function normalizePersonInput<T extends Partial<PersonInput>>(input: T): T {
  const out: Partial<PersonInput> = { ...input }

  for (const key of titleFields) {
    if (typeof out[key] === 'string') out[key] = titleCase(out[key] as string)
  }

  for (const key of upperFields) {
    if (typeof out[key] === 'string') out[key] = upperCode(out[key] as string)
  }

  for (const key of emailFields) {
    if (typeof out[key] === 'string') out[key] = normalizeEmail(out[key] as string)
  }

  if (typeof out.iban === 'string') out.iban = normalizeIban(out.iban)
  if (typeof out.postal_code === 'string') out.postal_code = cleanText(out.postal_code)
  if (typeof out.phone === 'string') out.phone = cleanText(out.phone)
  if (typeof out.notes === 'string') out.notes = out.notes.trim()
  if (typeof out.fad_password === 'string') out.fad_password = out.fad_password.trim()
  if (typeof out.gender === 'string') out.gender = upperCode(out.gender)
  if (typeof out.doc_type === 'string') out.doc_type = cleanText(out.doc_type)
  if (typeof out.inps_benefit === 'string') out.inps_benefit = cleanText(out.inps_benefit)

  return out as T
}
