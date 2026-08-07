import { supabase } from '../lib/supabase'
import type { CourseStaffingCounts } from '../data/courseStaffing'
import type { CourseStaffRole } from '../types/db'

async function countRole(courseId: string, role: CourseStaffRole): Promise<number> {
  const { count, error } = await supabase
    .from('course_staff')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('role', role)
  if (error) throw error
  return count ?? 0
}

export async function fetchCourseStaffingCounts(courseId: string): Promise<CourseStaffingCounts> {
  const [teacher, tutor, admin_staff] = await Promise.all([
    countRole(courseId, 'teacher'),
    countRole(courseId, 'tutor'),
    countRole(courseId, 'admin_staff'),
  ])
  return { teacher, tutor, admin_staff }
}
