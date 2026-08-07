import { school } from '../data/school'

/** Blocco testuale per intestazione moduli / documenti. */
export function schoolHeaderLines(): string[] {
  return [
    school.name,
    school.address,
    `P.IVA ${school.vatNumber} · REA ${school.rea}`,
    `SDI ${school.sdiCode}`,
    school.email,
    school.phone,
  ]
}

export function schoolContactsLine(): string {
  return `${school.email} · ${school.phone}`
}
