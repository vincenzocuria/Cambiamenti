import { formatCourseShareLabel } from './fadShareMessage'

export type CourseMembership = {
  name: string
  edition?: string | null
}

/** Etichetta dei corsi collegati a una persona. `empty` se non ce n’è nessuno. */
export function formatCourseMembership(
  courses: CourseMembership[] | undefined,
  empty = '—',
): string {
  if (!courses?.length) return empty
  return courses
    .map((course) => formatCourseShareLabel(course))
    .sort((a, b) => a.localeCompare(b, 'it'))
    .join(', ')
}
