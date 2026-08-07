import { supabase } from '../lib/supabase'
import { staffingOk, type CourseStaffingCounts } from '../data/courseStaffing'
import {
  activeCourseStatuses,
  courseStatuses,
  toReportCourseStatuses,
  upcomingCourseStatuses,
  type CourseStatus,
} from '../data/courseStatus'
import { courseRequiredRoles, personTypeMeta } from '../data/personTypes'
import { fullName } from '../lib/format'
import type { Course } from '../types/db'

export interface DashboardCounts {
  courses: number
  students: number
  people: number
  templates: number
  inCorso: number
  prossimi: number
  daRendicontare: number
  esitoChiuso: number
  byStatus: Record<CourseStatus, number>
}

export interface DashboardCourseRow {
  id: string
  name: string
  edition: string
  status: CourseStatus
  start_date: string | null
  end_date: string | null
}

export interface IncompleteCourse {
  id: string
  name: string
  edition: string
  counts: CourseStaffingCounts
}

export interface PersonAlert {
  id: string
  name: string
  kind: 'staff' | 'student'
  missing: ('email' | 'fad')[]
}

async function countTable(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

function emptyStatusCounts(): Record<CourseStatus, number> {
  return Object.fromEntries(courseStatuses.map((s) => [s, 0])) as Record<CourseStatus, number>
}

export async function fetchDashboardCounts(): Promise<DashboardCounts> {
  const [students, people, templates, coursesRes] = await Promise.all([
    countTable('students'),
    countTable('people'),
    countTable('document_templates'),
    supabase.from('courses').select('status'),
  ])
  if (coursesRes.error) throw coursesRes.error

  const byStatus = emptyStatusCounts()
  for (const row of coursesRes.data ?? []) {
    const status = row.status as CourseStatus
    if (status in byStatus) byStatus[status] += 1
  }

  const sum = (statuses: CourseStatus[]) =>
    statuses.reduce((acc, s) => acc + byStatus[s], 0)

  return {
    courses: coursesRes.data?.length ?? 0,
    students,
    people,
    templates,
    inCorso: sum(activeCourseStatuses),
    prossimi: sum(upcomingCourseStatuses),
    daRendicontare: sum(toReportCourseStatuses),
    esitoChiuso: byStatus.esito_chiuso,
    byStatus,
  }
}

const courseListSelect = 'id, name, edition, status, start_date, end_date'

async function fetchCoursesByStatuses(
  statuses: CourseStatus[],
  orderBy: 'start_date' | 'end_date',
  ascending: boolean,
): Promise<DashboardCourseRow[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(courseListSelect)
    .in('status', statuses)
    .order(orderBy, { ascending, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as DashboardCourseRow[]
}

export async function fetchUpcomingCourses(): Promise<DashboardCourseRow[]> {
  return fetchCoursesByStatuses(upcomingCourseStatuses, 'start_date', true)
}

export async function fetchActiveCourses(): Promise<DashboardCourseRow[]> {
  return fetchCoursesByStatuses(activeCourseStatuses, 'end_date', true)
}

export async function fetchCoursesToReport(): Promise<DashboardCourseRow[]> {
  return fetchCoursesByStatuses(toReportCourseStatuses, 'end_date', true)
}

export async function fetchIncompleteCourses(): Promise<IncompleteCourse[]> {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, name, edition')
    .order('name')
  if (error) throw error

  const { data: staffRows, error: staffError } = await supabase
    .from('course_staff')
    .select('course_id, role')
  if (staffError) throw staffError

  const byCourse = new Map<string, CourseStaffingCounts>()
  for (const c of courses ?? []) {
    byCourse.set(c.id, { teacher: 0, tutor: 0, admin_staff: 0 })
  }
  for (const row of staffRows ?? []) {
    const counts = byCourse.get(row.course_id)
    if (!counts) continue
    const role = row.role as keyof CourseStaffingCounts
    if (role in counts) counts[role] += 1
  }

  return (courses as Pick<Course, 'id' | 'name' | 'edition'>[])
    .filter((c) => {
      const counts = byCourse.get(c.id)!
      return !staffingOk(counts)
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      edition: c.edition,
      counts: byCourse.get(c.id)!,
    }))
}

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  fad_email: string
  fad_password: string
}

function alertsFromRows(rows: PersonRow[], kind: 'staff' | 'student'): PersonAlert[] {
  return rows
    .map((p) => {
      const missing: ('email' | 'fad')[] = []
      if (!p.email?.trim()) missing.push('email')
      const fadEmail = p.fad_email?.trim() || p.email?.trim()
      if (!fadEmail || !p.fad_password?.trim()) missing.push('fad')
      if (missing.length === 0) return null
      return { id: p.id, name: fullName(p), kind, missing }
    })
    .filter((x): x is PersonAlert => x != null)
}

export async function fetchPeopleCredentialAlerts(): Promise<PersonAlert[]> {
  const select = 'id, first_name, last_name, email, fad_email, fad_password'
  const [peopleRes, studentsRes] = await Promise.all([
    supabase.from('people').select(select).order('last_name'),
    supabase.from('students').select(select).order('last_name'),
  ])
  if (peopleRes.error) throw peopleRes.error
  if (studentsRes.error) throw studentsRes.error

  return [
    ...alertsFromRows((peopleRes.data ?? []) as PersonRow[], 'staff'),
    ...alertsFromRows((studentsRes.data ?? []) as PersonRow[], 'student'),
  ]
}

export function staffingGapsLabel(counts: CourseStaffingCounts): string {
  return courseRequiredRoles
    .filter((role) => counts[role] < personTypeMeta[role].courseMin)
    .map((role) => {
      const meta = personTypeMeta[role]
      return `${meta.title}: ${counts[role]}/${meta.courseMin}`
    })
    .join(' · ')
}
