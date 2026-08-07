import { supabase } from '../lib/supabase'
import { normalizeCourseInput } from '../lib/normalizeCourseInput'
import type { Course, CourseInput } from '../types/db'
import { sendNotificationEmail } from './sendNotificationEmail'

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
  const { data, error } = await supabase
    .from('courses')
    .insert(normalizeCourseInput(input))
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCourse(id: string, input: Partial<CourseInput>): Promise<Course> {
  const prev =
    input.status !== undefined
      ? await supabase.from('courses').select('status, name, edition').eq('id', id).single()
      : null
  if (prev?.error) throw prev.error

  const { data, error } = await supabase
    .from('courses')
    .update(normalizeCourseInput(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (
    input.status === 'finito' &&
    prev?.data &&
    prev.data.status !== 'finito'
  ) {
    const label = [data.name, data.edition].filter(Boolean).join(' — ')
    try {
      await sendNotificationEmail({
        type: 'course_to_report',
        title: 'Corso da rendicontare',
        body: `${label} è finito e deve essere rendicontato.`,
        link: `/corsi/${id}`,
      })
    } catch {
      /* notifica in-app già creata dal trigger DB */
    }
  }

  return data
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}
