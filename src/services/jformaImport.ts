import { defaultCourseStatus } from '../data/courseStatus'
import { findCourseMatch, matchCourseIdFromText } from '../lib/courseMatch'
import { parseIcsCalendar } from '../lib/parseIcsCalendar'
import { parseJformaCourseCsv } from '../lib/parseJformaCourseCsv'
import type { CourseInput } from '../types/db'
import { upsertCalendarEventByUid } from './calendarEvents'
import { createCourse, listCourses, updateCourse } from './courses'

export interface CourseImportSummary {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export interface EventImportSummary {
  created: number
  updated: number
  unassigned: number
  errors: string[]
}

export async function importCoursesFromCsv(csvText: string): Promise<CourseImportSummary> {
  const summary: CourseImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] }
  const rows = parseJformaCourseCsv(csvText)
  if (rows.length === 0) {
    summary.errors.push('Nessuna riga corso valida nel CSV (serve almeno la colonna nome/titolo).')
    return summary
  }

  let courses = await listCourses()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 2
    try {
      const existing = findCourseMatch(courses, row)
      const payload: CourseInput = {
        name: row.name,
        edition: row.edition,
        code: row.code,
        cup: row.cup,
        notes: row.notes,
        status: existing?.status ?? defaultCourseStatus,
        start_date: row.start_date,
        end_date: row.end_date,
        duration_hours: row.duration_hours,
      }

      if (existing) {
        const updated = await updateCourse(existing.id, payload)
        courses = courses.map((c) => (c.id === updated.id ? updated : c))
        summary.updated++
      } else {
        const created = await createCourse(payload)
        courses = [...courses, created]
        summary.created++
      }
    } catch (e) {
      summary.skipped++
      summary.errors.push(`Riga ${line}: ${errorMessage(e)}`)
    }
  }

  return summary
}

export async function importEventsFromIcs(icsText: string): Promise<EventImportSummary> {
  const summary: EventImportSummary = { created: 0, updated: 0, unassigned: 0, errors: [] }
  const parsed = parseIcsCalendar(icsText)
  if (parsed.length === 0) {
    summary.errors.push('Nessun evento VEVENT trovato nel file ICS.')
    return summary
  }

  const courses = await listCourses()

  for (let i = 0; i < parsed.length; i++) {
    const ev = parsed[i]
    try {
      const courseId =
        matchCourseIdFromText(courses, ev.title, ev.room, ev.notes) ??
        null

      if (!courseId) summary.unassigned++

      const result = await upsertCalendarEventByUid({
        course_id: courseId,
        title: ev.title,
        starts_at: ev.starts_at,
        ends_at: ev.ends_at,
        room: ev.room,
        notes: ev.notes,
        external_uid: ev.external_uid,
      })

      if (result === 'created') summary.created++
      else summary.updated++
    } catch (e) {
      summary.errors.push(`Evento ${i + 1}: ${errorMessage(e)}`)
    }
  }

  return summary
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
