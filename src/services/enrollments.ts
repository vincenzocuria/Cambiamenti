import { isCourseStaffRole } from '../data/personTypes'
import { type CourseMembership } from '../lib/courseMembershipLabel'
import { sortPeople } from '../lib/sortPeople'
import { supabase } from '../lib/supabase'
import { uniqueCourseRoleMessage } from '../lib/uniqueCourseRole'
import type { Course, CourseStaffAssignment, CourseStaffRole, Person, PersonType } from '../types/db'

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

/** Dati dell'incarico (moduli, ore, compenso orario) di una figura sul corso. */
export async function getCourseStaffAssignment(
  courseId: string,
  personId: string,
): Promise<CourseStaffAssignment | null> {
  const { data, error } = await supabase
    .from('course_staff')
    .select('role, modules, hours, hourly_rate')
    .eq('course_id', courseId)
    .eq('person_id', personId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    role: data.role as CourseStaffRole,
    modules: data.modules ?? '',
    hours: data.hours == null ? null : Number(data.hours),
    hourly_rate: data.hourly_rate == null ? null : Number(data.hourly_rate),
  }
}

export async function updateCourseStaffAssignment(
  courseId: string,
  personId: string,
  input: Pick<CourseStaffAssignment, 'modules' | 'hours' | 'hourly_rate'>,
): Promise<void> {
  const { error } = await supabase
    .from('course_staff')
    .update({ modules: input.modules.trim(), hours: input.hours, hourly_rate: input.hourly_rate })
    .eq('course_id', courseId)
    .eq('person_id', personId)
  if (error) throw error
}

/** Incarichi di un ruolo sul corso, per persona. */
export async function listCourseStaffAssignments(
  courseId: string,
  role: CourseStaffRole,
): Promise<Map<string, CourseStaffAssignment>> {
  const { data, error } = await supabase
    .from('course_staff')
    .select('person_id, role, modules, hours, hourly_rate')
    .eq('course_id', courseId)
    .eq('role', role)
  if (error) throw error
  return new Map(
    (data ?? []).map((r) => [
      r.person_id as string,
      {
        role: r.role as CourseStaffRole,
        modules: r.modules ?? '',
        hours: r.hours == null ? null : Number(r.hours),
        hourly_rate: r.hourly_rate == null ? null : Number(r.hourly_rate),
      },
    ]),
  )
}

export type EnrollmentStatus = 'attivo' | 'ritirato' | 'trasferito'

export interface EnrollmentInfo {
  status: EnrollmentStatus
  enrolled_on: string | null
  left_on: string | null
  status_note: string
  from_course: { id: string; name: string; edition: string | null } | null
  to_course: { id: string; name: string; edition: string | null } | null
}

/** Stato dell'iscrizione di ogni alunno del corso (attivo, ritirato, trasferito). */
export async function listCourseEnrollments(courseId: string): Promise<Map<string, EnrollmentInfo>> {
  const { data, error } = await supabase
    .from('course_students')
    .select(
      'student_id, status, enrolled_on, left_on, status_note, from_course:courses!course_students_transferred_from_fkey(id, name, edition), to_course:courses!course_students_transferred_to_fkey(id, name, edition)',
    )
    .eq('course_id', courseId)
  if (error) throw error
  const map = new Map<string, EnrollmentInfo>()
  for (const r of (data ?? []) as unknown as (EnrollmentInfo & { student_id: string })[]) {
    map.set(r.student_id, {
      status: r.status,
      enrolled_on: r.enrolled_on,
      left_on: r.left_on,
      status_note: r.status_note ?? '',
      from_course: r.from_course,
      to_course: r.to_course,
    })
  }
  return map
}

/** Ritiro: l'alunno resta nello storico del corso ma non conta più dal giorno indicato. */
export async function withdrawStudent(courseId: string, studentId: string, onDay: string, note: string) {
  const { error } = await supabase
    .from('course_students')
    .update({ status: 'ritirato', left_on: onDay, status_note: note, transferred_to: null })
    .eq('course_id', courseId)
    .eq('student_id', studentId)
  if (error) throw error
}

/**
 * Trasferimento ad altro corso dal giorno indicato: nel corso di partenza l'alunno risulta
 * «trasferito», in quello di arrivo è iscritto da quel giorno.
 */
export async function transferStudent(
  fromCourseId: string,
  toCourseId: string,
  studentId: string,
  onDay: string,
  note: string,
) {
  if (fromCourseId === toCourseId) throw new Error('Scegli un corso diverso da quello attuale')
  const { data: existing, error: readError } = await supabase
    .from('course_students')
    .select('status')
    .eq('course_id', toCourseId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (readError) throw readError
  if (existing && existing.status === 'attivo') throw new Error("L'alunno è già iscritto al corso di destinazione")
  const { error: insertError } = await supabase.from('course_students').upsert(
    {
      course_id: toCourseId,
      student_id: studentId,
      status: 'attivo',
      enrolled_on: onDay,
      left_on: null,
      status_note: note,
      transferred_from: fromCourseId,
      transferred_to: null,
    },
    { onConflict: 'course_id,student_id' },
  )
  if (insertError) throw insertError
  const { error } = await supabase
    .from('course_students')
    .update({ status: 'trasferito', left_on: onDay, status_note: note, transferred_to: toCourseId })
    .eq('course_id', fromCourseId)
    .eq('student_id', studentId)
  if (error) throw error
}

/** Annulla ritiro o trasferimento: l'alunno torna attivo nel corso (il corso di arrivo non viene toccato). */
export async function reactivateStudent(courseId: string, studentId: string) {
  const { error } = await supabase
    .from('course_students')
    .update({ status: 'attivo', left_on: null, status_note: '', transferred_to: null })
    .eq('course_id', courseId)
    .eq('student_id', studentId)
  if (error) throw error
}
