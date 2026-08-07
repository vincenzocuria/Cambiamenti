import { supabase } from '../lib/supabase'
import { metaFor } from '../data/personTypes'
import { normalizePersonInput } from '../lib/normalizePersonInput'
import { personTablePayload } from '../lib/personPayload'
import type { Person, PersonInput, PersonType } from '../types/db'

function normalizePerson(row: Person): Person {
  return { ...row, inps_benefit: row.inps_benefit ?? '' }
}

export async function listPeople(type: PersonType): Promise<Person[]> {
  const { data, error } = await supabase
    .from(metaFor(type).table)
    .select('*')
    .order('last_name')
    .order('first_name')
  if (error) throw error
  return (data as Person[]).map(normalizePerson)
}

export async function getPerson(type: PersonType, id: string): Promise<Person> {
  const { data, error } = await supabase.from(metaFor(type).table).select('*').eq('id', id).single()
  if (error) throw error
  return normalizePerson(data as Person)
}

export async function createPerson(type: PersonType, input: PersonInput): Promise<Person> {
  const { data, error } = await supabase
    .from(metaFor(type).table)
    .insert(personTablePayload(type, normalizePersonInput(input)))
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Esiste già una figura con questo codice fiscale: usala dall’elenco personale.')
    }
    throw error
  }
  return normalizePerson(data as Person)
}

export async function updatePerson(
  type: PersonType,
  id: string,
  input: Partial<PersonInput>,
): Promise<Person> {
  const { data, error } = await supabase
    .from(metaFor(type).table)
    .update(personTablePayload(type, normalizePersonInput(input)))
    .eq('id', id)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Esiste già una figura con questo codice fiscale.')
    }
    throw error
  }
  return normalizePerson(data as Person)
}

export async function deletePerson(type: PersonType, id: string): Promise<void> {
  const { error } = await supabase.from(metaFor(type).table).delete().eq('id', id)
  if (error) throw error
}

/** Ruoli ricoperti da una figura del personale sui corsi. */
export async function listStaffRoles(personId: string): Promise<
  { course_id: string; role: string; course_name: string; course_edition: string }[]
> {
  const { data, error } = await supabase
    .from('course_staff')
    .select('course_id, role, course:courses(name, edition)')
    .eq('person_id', personId)
  if (error) throw error
  return (data as unknown as {
    course_id: string
    role: string
    course: { name: string; edition: string }
  }[]).map((r) => ({
    course_id: r.course_id,
    role: r.role,
    course_name: r.course?.name ?? '',
    course_edition: r.course?.edition ?? '',
  }))
}
