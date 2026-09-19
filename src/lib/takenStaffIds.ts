import { courseRequiredRoles } from '../data/personTypes'
import type { Person, PersonType } from '../types/db'

/** Id del personale già assegnato a un ruolo sul corso. */
export function takenStaffIds(peopleByType: Partial<Record<PersonType, Person[]>>): string[] {
  const ids = new Set<string>()
  for (const role of courseRequiredRoles) {
    for (const person of peopleByType[role] ?? []) {
      if (person?.id) ids.add(person.id)
    }
  }
  return [...ids]
}
