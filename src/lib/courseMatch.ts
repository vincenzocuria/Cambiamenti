import type { Course } from '../types/db'
import type { JformaCourseRow } from './parseJformaCourseCsv'

export function findCourseMatch(courses: Course[], row: JformaCourseRow): Course | undefined {
  const code = row.code.trim()
  if (code) {
    const upper = code.toUpperCase()
    const hit = courses.find((c) => c.code.trim().toUpperCase() === upper)
    if (hit) return hit
  }

  const name = row.name.trim().toLowerCase()
  const edition = row.edition.trim().toLowerCase()
  return courses.find(
    (c) => c.name.trim().toLowerCase() === name && c.edition.trim().toLowerCase() === edition,
  )
}

/** Cerca un codice corso nel testo evento (titolo, luogo, note). */
export function matchCourseIdFromText(courses: Course[], ...parts: string[]): string | null {
  const haystack = parts.join(' ').toUpperCase()
  if (!haystack.trim()) return null

  const withCode = courses
    .map((c) => ({ c, code: c.code.trim().toUpperCase() }))
    .filter((x) => x.code.length >= 2)
    .sort((a, b) => b.code.length - a.code.length)

  for (const { c, code } of withCode) {
    if (haystack.includes(code)) return c.id
  }
  return null
}
