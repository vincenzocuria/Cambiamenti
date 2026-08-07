import type { PersonInput, PersonType } from '../types/db'

/** Campi presenti solo sulla tabella students. */
const studentOnlyKeys = ['inps_benefit'] as const

/** Payload sicuro per insert/update sulla tabella del tipo persona. */
export function personTablePayload(
  type: PersonType,
  input: Partial<PersonInput>,
): Partial<PersonInput> {
  if (type === 'student') return input

  const next = { ...input }
  for (const key of studentOnlyKeys) {
    delete next[key]
  }
  return next
}
