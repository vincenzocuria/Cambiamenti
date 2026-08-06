import { supabase } from '../lib/supabase'
import type { Course, CourseInput } from '../types/db'

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data
}

export async function getCourse(id: string): Promise<Course> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCourse(input: CourseInput): Promise<Course> {
  const { data, error } = await supabase.from('courses').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateCourse(id: string, input: Partial<CourseInput>): Promise<Course> {
  const { data, error } = await supabase.from('courses').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}
