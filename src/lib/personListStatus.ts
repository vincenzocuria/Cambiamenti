import { hasPaidInpsBenefit } from '../data/inpsBenefits'
import { hasCompleteFadCredentials } from './fadCredentials'
import type { Person } from '../types/db'

export const personListStatuses = [
  'fad_ok',
  'fad_da_compilare',
  'senza_email',
  'con_inps',
] as const

export type PersonListStatus = (typeof personListStatuses)[number]

export function isPersonListStatus(value: string): value is PersonListStatus {
  return (personListStatuses as readonly string[]).includes(value)
}

export function personHasEmail(person: Pick<Person, 'email'>): boolean {
  return Boolean(person.email?.trim())
}

export function matchesPersonStatus(person: Person, status: string): boolean {
  if (!status) return true
  if (status === 'fad_ok') return hasCompleteFadCredentials(person)
  if (status === 'fad_da_compilare') return !hasCompleteFadCredentials(person)
  if (status === 'senza_email') return !personHasEmail(person)
  if (status === 'con_inps') return hasPaidInpsBenefit(person.inps_benefit)
  return true
}

export function countPersonStatuses(people: Person[]) {
  const counts = { fad_ok: 0, fad_da_compilare: 0, senza_email: 0, con_inps: 0 }
  for (const p of people) {
    if (hasCompleteFadCredentials(p)) counts.fad_ok += 1
    else counts.fad_da_compilare += 1
    if (!personHasEmail(p)) counts.senza_email += 1
    if (hasPaidInpsBenefit(p.inps_benefit)) counts.con_inps += 1
  }
  return counts
}
