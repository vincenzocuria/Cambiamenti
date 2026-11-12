import { supabase } from '../lib/supabase'
import type { FadAttendance, FadLogEventRow, FadSession } from '../types/db'

export interface FadAttendanceRow extends FadAttendance {
  student: { id: string; first_name: string; last_name: string; tax_code: string } | null
}

export interface FadSessionWithRows extends FadSession {
  rows: FadAttendanceRow[]
}

export interface FadAttendanceSyncResult {
  newEvents: number
  readEvents?: number
  days: number
  rows: number
  keptManual: number
  unmatched: string[]
}

export interface MoodleCourseOption {
  id: number
  name: string
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sync-fad-attendance', { body })
  if (error) {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    if (context?.json) {
      try {
        const payload = await context.json()
        if (payload?.error) throw new Error(payload.error)
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw new Error(error.message || 'Lettura presenze non riuscita')
  }
  const payload = data as (T & { error?: string }) | null
  if (!payload) throw new Error('Risposta non valida')
  if (payload.error) throw new Error(payload.error)
  return payload
}

/** Legge il registro eventi da Moodle e ricalcola le presenze (le correzioni a mano restano). */
export function syncFadAttendance(courseId: string): Promise<FadAttendanceSyncResult> {
  return invoke({ action: 'sync', courseId })
}

/** Ricalcola dagli eventi già salvati, per esempio dopo aver corretto l'ora di chiusura. */
export function recomputeFadAttendance(courseId: string): Promise<FadAttendanceSyncResult> {
  return invoke({ action: 'recompute', courseId })
}

export async function listMoodleCourses(): Promise<MoodleCourseOption[]> {
  const res = await invoke<{ courses: MoodleCourseOption[] }>({ action: 'courses' })
  return res.courses
}

export async function linkMoodleCourse(courseId: string, moodleCourseId: number | null): Promise<void> {
  const { error } = await supabase.from('courses').update({ moodle_course_id: moodleCourseId }).eq('id', courseId)
  if (error) throw error
}

export async function listFadSessions(courseId: string): Promise<FadSessionWithRows[]> {
  const { data, error } = await supabase
    .from('fad_sessions')
    .select('*, rows:fad_attendance(*, student:students(id, first_name, last_name, tax_code))')
    .eq('course_id', courseId)
    .order('day')
  if (error) throw error
  return (data ?? []) as unknown as FadSessionWithRows[]
}

export async function updateFadSession(
  id: string,
  input: Partial<Pick<FadSession, 'closed_at' | 'closed_source' | 'closed_note' | 'manual' | 'excluded' | 'note'>>,
): Promise<void> {
  const { error } = await supabase.from('fad_sessions').update(input).eq('id', id)
  if (error) throw error
}

export async function updateFadAttendance(
  id: string,
  input: Partial<
    Pick<
      FadAttendance,
      'first_join_at' | 'exit_at' | 'exit_source' | 'status' | 'minutes' | 'pause_minutes' | 'manual' | 'note'
    >
  >,
): Promise<void> {
  const { error } = await supabase.from('fad_attendance').update(input).eq('id', id)
  if (error) throw error
}

export async function listFadLogEvents(courseId: string): Promise<FadLogEventRow[]> {
  const out: FadLogEventRow[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('fad_log_events')
      .select('*')
      .eq('course_id', courseId)
      .order('occurred_at')
      .range(from, from + page - 1)
    if (error) throw error
    out.push(...((data ?? []) as FadLogEventRow[]))
    if (!data || data.length < page) break
  }
  return out
}
