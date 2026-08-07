import type { Person } from '../types/db'

export function hasFadEmail(person: Pick<Person, 'fad_email' | 'email'>): boolean {
  return Boolean(person.fad_email?.trim() || person.email?.trim())
}

export function hasFadPassword(person: Pick<Person, 'fad_password'>): boolean {
  return Boolean(person.fad_password?.trim())
}

export function hasCompleteFadCredentials(
  person: Pick<Person, 'fad_email' | 'email' | 'fad_password'>,
): boolean {
  return hasFadEmail(person) && hasFadPassword(person)
}

/** Email usata per la FAD: dedicata se presente, altrimenti anagrafica. */
export function effectiveFadEmail(person: Pick<Person, 'fad_email' | 'email'>): string {
  return person.fad_email?.trim() || person.email?.trim() || ''
}
