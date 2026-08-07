import { supabase } from '../lib/supabase'
import type { Course, CourseStaffRole, Person, PersonType } from '../types/db'

function isCourseStaffRole(type: PersonType): type is CourseStaffRole {
  return type === 'teacher' || type === 'tutor' || type === 'admin_staff'
}

export async function listCoursePeople(type: PersonType, courseId: string): Promise<Person[]> {
  if (type === 'student') {
    const { data, error } = await supabase
      .from('course_students')
      .select('person:students(*)')
      .eq('course_id', courseId)
    if (error) throw error
    return (data as unknown as { person: Person }[])
      .map((r) => r.person)
      .sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
  }

  if (!isCourseStaffRole(type)) {
    throw new Error('Tipo non valido per assegnazione corso')
  }

  const { data, error } = await supabase
    .from('course_staff')
    .select('person:people(*)')
    .eq('course_id', courseId)
    .eq('role', type)
  if (error) throw error
  return (data as unknown as { person: Person }[])
    .map((r) => r.person)
    .sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
}

export async function listPersonCourses(type: PersonType, personId: string): Promise<Course[]> {
  if (type === 'student') {
    const { data, error } = await supabase
      .from('course_students')
      .select('course:courses(*)')
      .eq('student_id', personId)
    if (error) throw error
    return (data as unknown as { course: Course }[]).map((r) => r.course)
  }

  // Personale: tutti i corsi in cui compare, con qualsiasi ruolo
  const { data, error } = await supabase
    .from('course_staff')
    .select('course:courses(*)')
    .eq('person_id', personId)
  if (error) throw error
  const courses = (data as unknown as { course: Course }[]).map((r) => r.course)
  const byId = new Map(courses.map((c) => [c.id, c]))
  return [...byId.values()]
}

export async function addToCourse(type: PersonType, courseId: string, personId: string): Promise<void> {
  if (type === 'student') {
    const { error } = await supabase
      .from('course_students')
      .insert({ course_id: courseId, student_id: personId })
    if (error) throw error
    return
  }

  if (!isCourseStaffRole(type)) throw new Error('Tipo non valido per assegnazione corso')

  const { error } = await supabase.from('course_staff').insert({
    course_id: courseId,
    person_id: personId,
    role: type,
  })
  if (error) throw error
}

export async function removeFromCourse(
  type: PersonType,
  courseId: string,
  personId: string,
): Promise<void> {
  if (type === 'student') {
    const { error } = await supabase
      .from('course_students')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', personId)
    if (error) throw error
    return
  }

  if (!isCourseStaffRole(type)) throw new Error('Tipo non valido per assegnazione corso')

  const { error } = await supabase
    .from('course_staff')
    .delete()
    .eq('course_id', courseId)
    .eq('person_id', personId)
    .eq('role', type)
  if (error) throw error
}
