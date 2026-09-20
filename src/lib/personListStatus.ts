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

export function countPersonStatus(people: Person[], status: PersonListStatus): number {
  return people.filter((p) => matchesPersonStatus(p, status)).length
}
