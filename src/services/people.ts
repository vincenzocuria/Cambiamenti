import { supabase } from '../lib/supabase'
import type { Person, PersonInput, PersonType } from '../types/db'

// CRUD condiviso per alunni e docenti: stessa anagrafica, tabelle diverse
function tableFor(type: PersonType): 'students' | 'teachers' {
  return type === 'student' ? 'students' : 'teachers'
}

export async function listPeople(type: PersonType): Promise<Person[]> {
  const { data, error } = await supabase
    .from(tableFor(type))
    .select('*')
    .order('last_name')
    .order('first_name')
  if (error) throw error
  return data
}

export async function getPerson(type: PersonType, id: string): Promise<Person> {
  const { data, error } = await supabase.from(tableFor(type)).select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createPerson(type: PersonType, input: PersonInput): Promise<Person> {
  const { data, error } = await supabase.from(tableFor(type)).insert(input).select().single()
  if (error) throw error
  return data
}

export async function updatePerson(type: PersonType, id: string, input: Partial<PersonInput>): Promise<Person> {
  const { data, error } = await supabase.from(tableFor(type)).update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePerson(type: PersonType, id: string): Promise<void> {
  const { error } = await supabase.from(tableFor(type)).delete().eq('id', id)
  if (error) throw error
}
