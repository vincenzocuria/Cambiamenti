import { supabase } from '../lib/supabase'
import type { CourseReportLine } from '../types/db'

/** Collega un documento ad altri corsi (oltre a quello principale). */
export async function linkDocumentToCourses(documentId: string, courseIds: string[]): Promise<void> {
  if (!courseIds.length) return
  const { error } = await supabase
    .from('document_courses')
    .upsert(
      courseIds.map((course_id) => ({ document_id: documentId, course_id })),
      { onConflict: 'document_id,course_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

/** Id dei documenti collegati a un corso. */
export async function listCourseDocumentIds(courseId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('document_courses')
    .select('document_id')
    .eq('course_id', courseId)
  if (error) throw error
  return data.map((r) => r.document_id as string)
}

/** Per ogni documento, i corsi a cui è collegato. */
export async function listDocumentCourseLinks(documentIds: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  if (!documentIds.length) return out
  const { data, error } = await supabase
    .from('document_courses')
    .select('document_id, course_id')
    .in('document_id', documentIds)
  if (error) throw error
  for (const row of data) {
    const id = row.document_id as string
    ;(out[id] ??= []).push(row.course_id as string)
  }
  return out
}

export type CourseReportLineInput = Omit<CourseReportLine, 'id' | 'created_at'>

export async function saveReportLines(lines: CourseReportLineInput[]): Promise<void> {
  if (!lines.length) return
  const { error } = await supabase
    .from('course_report_lines')
    .upsert(lines, { onConflict: 'document_id,course_id' })
  if (error) throw error
}

export async function listCourseReportLines(courseId: string): Promise<CourseReportLine[]> {
  const { data, error } = await supabase
    .from('course_report_lines')
    .select('*')
    .eq('course_id', courseId)
    .order('protocol_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data
}
