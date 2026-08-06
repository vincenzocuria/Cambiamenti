import { supabase } from '../lib/supabase'
import type { Course, Person, PersonType } from '../types/db'

function joinTable(type: PersonType): 'course_students' | 'course_teachers' {
  return type === 'student' ? 'course_students' : 'course_teachers'
}

function fkColumn(type: PersonType): 'student_id' | 'teacher_id' {
  return type === 'student' ? 'student_id' : 'teacher_id'
}

function sourceTable(type: PersonType): 'students' | 'teachers' {
  return type === 'student' ? 'students' : 'teachers'
}

// Persone associate a un corso
export async function listCoursePeople(type: PersonType, courseId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from(joinTable(type))
    .select(`person:${sourceTable(type)}(*)`)
    .eq('course_id', courseId)
  if (error) throw error
  return (data as unknown as { person: Person }[])
    .map((r) => r.person)
    .sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
}

// Corsi associati a una persona
export async function listPersonCourses(type: PersonType, personId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from(joinTable(type))
    .select('course:courses(*)')
    .eq(fkColumn(type), personId)
  if (error) throw error
  return (data as unknown as { course: Course }[]).map((r) => r.course)
}

export async function addToCourse(type: PersonType, courseId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from(joinTable(type))
    .insert({ course_id: courseId, [fkColumn(type)]: personId })
  if (error) throw error
}

export async function removeFromCourse(type: PersonType, courseId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from(joinTable(type))
    .delete()
    .eq('course_id', courseId)
    .eq(fkColumn(type), personId)
  if (error) throw error
}
