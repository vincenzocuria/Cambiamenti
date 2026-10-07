import { isCourseStaffRole } from '../data/personTypes'
import { type CourseMembership } from '../lib/courseMembershipLabel'
import { sortPeople } from '../lib/sortPeople'
import { supabase } from '../lib/supabase'
import { uniqueCourseRoleMessage } from '../lib/uniqueCourseRole'
import type { Course, CourseStaffRole, Person, PersonType } from '../types/db'

function asCourseMembership(value: unknown): CourseMembership | null {
  if (Array.isArray(value)) return asCourseMembership(value[0])
  if (!value || typeof value !== 'object') return null
  const row = value as { name?: unknown; edition?: unknown }
  if (typeof row.name !== 'string' || !row.name.trim()) return null
  return {
    name: row.name,
    edition: typeof row.edition === 'string' ? row.edition : null,
  }
}

/** Corsi a cui ogni alunno è iscritto, in un’unica lettura (niente una query per riga). */
export async function listStudentCourseMap(): Promise<Map<string, CourseMembership[]>> {
  const map = new Map<string, CourseMembership[]>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('course_students')
      .select('student_id, course:courses(name, edition)')
      .range(from, from + pageSize - 1)
    if (error) throw error
    for (const row of data) {
      const course = asCourseMembership(row.course)
      if (!row.student_id || !course) continue
      const list = map.get(row.student_id) ?? []
      list.push(course)
      map.set(row.student_id, list)
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return map
}

export async function getCourseStaffRole(
  courseId: string,
  personId: string,
): Promise<CourseStaffRole | null> {
  const { data, error } = await supabase
    .from('course_staff')
    .select('role')
    .eq('course_id', courseId)
    .eq('person_id', personId)
    .maybeSingle()
  if (error) throw error
  return (data?.role as CourseStaffRole | undefined) ?? null
}

export async function listCoursePeople(type: PersonType, courseId: string): Promise<Person[]> {
  if (type === 'student') {
    const { data, error } = await supabase
      .from('course_students')
      .select('person:students(*)')
      .eq('course_id', courseId)
    if (error) throw error
    return sortPeople(
      (data as unknown as { person: Person }[]).map((r) => r.person),
      'name',
      'asc',
    )
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
  return sortPeople(
    (data as unknown as { person: Person }[]).map((r) => r.person),
    'name',
    'asc',
  )
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

export async function addStudentsToCourse(courseId: string, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return
  const { error } = await supabase
    .from('course_students')
    .insert(studentIds.map((student_id) => ({ course_id: courseId, student_id })))
  if (error) throw error
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

  const existing = await getCourseStaffRole(courseId, personId)
  if (existing) throw new Error(uniqueCourseRoleMessage(existing))

  const { error } = await supabase.from('course_staff').insert({
    course_id: courseId,
    person_id: personId,
    role: type,
  })
  if (error) {
    if (error.code === '23505') throw new Error(uniqueCourseRoleMessage(type))
    throw error
  }
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
