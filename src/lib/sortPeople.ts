import { inpsBenefitLabel } from '../data/inpsBenefits'
import { hasCompleteFadCredentials } from './fadCredentials'
import { checkStudentDocuments } from './studentDocumentStatus'
import type { Person } from '../types/db'

export const personSortKeys = [
  'name',
  'tax_code',
  'birth_date',
  'email',
  'fad',
  'phone',
  'city',
  'inps',
  'documenti',
] as const

export type PersonSortKey = (typeof personSortKeys)[number]

export type SortDirection = 'asc' | 'desc'

export const DEFAULT_PERSON_SORT: PersonSortKey = 'name'
export const DEFAULT_SORT_DIRECTION: SortDirection = 'asc'

export function isPersonSortKey(value: string): value is PersonSortKey {
  return (personSortKeys as readonly string[]).includes(value)
}

export function isSortDirection(value: string): value is SortDirection {
  return value === 'asc' || value === 'desc'
}

export type PersonSortContext = {
  hasIdentityFile?: (personId: string) => boolean
}

/** Schede corso e selezioni: lo stato documenti si ordina solo in anagrafica alunni. */
export function personBrowseSortKeys(includeInps: boolean): PersonSortKey[] {
  return personSortKeys.filter((key) => {
    if (key === 'documenti') return false
    if (key === 'inps') return includeInps
    return true
  })
}

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim()
}

/** Valori vuoti sempre in fondo, in entrambe le direzioni. */
function compareBlankLast(
  aEmpty: boolean,
  bEmpty: boolean,
  cmp: () => number,
  dir: SortDirection,
): number {
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  const n = cmp()
  return dir === 'asc' ? n : -n
}

function compareText(a: string, b: string, dir: SortDirection): number {
  const aEmpty = isBlank(a)
  const bEmpty = isBlank(b)
  return compareBlankLast(aEmpty, bEmpty, () => a.localeCompare(b, 'it'), dir)
}

function sortValueForKey(person: Person, key: PersonSortKey, context?: PersonSortContext): string {
  switch (key) {
    case 'name':
      return `${person.last_name}\t${person.first_name}`
    case 'tax_code':
      return person.tax_code ?? ''
    case 'birth_date':
      return person.birth_date ?? ''
    case 'email':
      return person.email ?? ''
    case 'fad':
      return hasCompleteFadCredentials(person) ? '0' : '1'
    case 'phone':
      return person.phone ?? ''
    case 'city':
      return person.city ?? ''
    case 'inps':
      return inpsBenefitLabel(person.inps_benefit) || person.inps_benefit || ''
    case 'documenti':
      return checkStudentDocuments(person, context?.hasIdentityFile?.(person.id) ?? false).ok
        ? '0'
        : '1'
  }
}

export function comparePeople(
  a: Person,
  b: Person,
  key: PersonSortKey,
  dir: SortDirection,
  context?: PersonSortContext,
): number {
  if (key === 'birth_date') {
    const aEmpty = isBlank(a.birth_date)
    const bEmpty = isBlank(b.birth_date)
    return compareBlankLast(
      aEmpty,
      bEmpty,
      () => (a.birth_date! < b.birth_date! ? -1 : a.birth_date! > b.birth_date! ? 1 : 0),
      dir,
    )
  }
  return compareText(sortValueForKey(a, key, context), sortValueForKey(b, key, context), dir)
}

export function sortPeople(
  people: Person[],
  key: PersonSortKey,
  dir: SortDirection,
  context?: PersonSortContext,
): Person[] {
  const copy = [...people]
  copy.sort((a, b) => comparePeople(a, b, key, dir, context))
  return copy
}
