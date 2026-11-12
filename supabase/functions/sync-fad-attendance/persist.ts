import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { FadLogEvent } from './reportCsv.ts'
import { reconstructCourse, type FadStudent } from './reconstruct.ts'

const PAGE = 1000

export async function saveEvents(db: SupabaseClient, courseId: string, events: FadLogEvent[]): Promise<number> {
  let saved = 0
  for (let i = 0; i < events.length; i += 500) {
    const chunk = events.slice(i, i + 500).map((e) => ({
      course_id: courseId,
      event_key: e.key,
      occurred_at: new Date(e.at).toISOString(),
      kind: e.kind,
      moodle_user_id: e.moodleUserId,
      user_name: e.userName,
      description: e.description,
      ip: e.ip,
    }))
    const { error, count } = await db
      .from('fad_log_events')
      .upsert(chunk, { onConflict: 'course_id,event_key', ignoreDuplicates: true, count: 'exact' })
    if (error) throw error
    saved += count ?? 0
  }
  return saved
}

async function loadEvents(db: SupabaseClient, courseId: string): Promise<FadLogEvent[]> {
  const out: FadLogEvent[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('fad_log_events')
      .select('event_key, occurred_at, kind, moodle_user_id, user_name, description, ip')
      .eq('course_id', courseId)
      .order('occurred_at')
      .order('event_key')
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data ?? []) {
      out.push({
        key: r.event_key,
        at: Date.parse(r.occurred_at),
        kind: r.kind,
        moodleUserId: r.moodle_user_id,
        userName: r.user_name,
        description: r.description,
        ip: r.ip,
      })
    }
    if (!data || data.length < PAGE) break
  }
  return out
}

async function loadStudents(db: SupabaseClient, courseId: string): Promise<FadStudent[]> {
  const { data, error } = await db
    .from('course_students')
    .select('enrolled_on, left_on, student:students(id, first_name, last_name)')
    .eq('course_id', courseId)
  if (error) throw error
  type Row = {
    enrolled_on: string | null
    left_on: string | null
    student: { id: string; first_name: string; last_name: string } | null
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.student)
    .map((r) => ({
      id: r.student!.id,
      firstName: r.student!.first_name,
      lastName: r.student!.last_name,
      fromDay: r.enrolled_on,
      untilDay: r.left_on,
    }))
}

export interface RecomputeResult {
  days: number
  rows: number
  keptManual: number
  unmatched: string[]
}

/** Ricalcola giornate e presenze dagli eventi salvati, senza toccare le correzioni manuali. */
export async function recompute(db: SupabaseClient, courseId: string): Promise<RecomputeResult> {
  const [events, students, sessionsRes] = await Promise.all([
    loadEvents(db, courseId),
    loadStudents(db, courseId),
    db.from('fad_sessions').select('id, day, closed_at, manual').eq('course_id', courseId),
  ])
  if (sessionsRes.error) throw sessionsRes.error
  const existing = new Map((sessionsRes.data ?? []).map((s) => [s.day as string, s]))
  const overrides = new Map<string, number | null>()
  for (const s of sessionsRes.data ?? []) {
    if (s.manual) overrides.set(s.day, s.closed_at ? Date.parse(s.closed_at) : null)
  }

  const days = reconstructCourse(events, students, overrides)
  const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString())
  let rows = 0
  let keptManual = 0
  const unmatched = new Set<string>()

  for (const d of days) {
    const prev = existing.get(d.day)
    let sessionId = prev?.id as string | undefined
    if (!prev) {
      const { data, error } = await db
        .from('fad_sessions')
        .insert({
          course_id: courseId,
          day: d.day,
          closed_at: iso(d.closure.at),
          closed_source: d.closure.source,
          closed_note: d.closure.note,
          closed_by: d.closure.by,
        })
        .select('id')
        .single()
      if (error) throw error
      sessionId = data.id
    } else if (!prev.manual) {
      const { error } = await db
        .from('fad_sessions')
        .update({
          closed_at: iso(d.closure.at),
          closed_source: d.closure.source,
          closed_note: d.closure.note,
          closed_by: d.closure.by,
        })
        .eq('id', prev.id)
      if (error) throw error
    }

    const { data: manualRows, error: manualError } = await db
      .from('fad_attendance')
      .select('student_id')
      .eq('session_id', sessionId)
      .eq('manual', true)
    if (manualError) throw manualError
    const manualIds = new Set((manualRows ?? []).map((r) => r.student_id))
    keptManual += manualIds.size

    const upserts = d.students
      .filter((s) => !manualIds.has(s.studentId))
      .map((s) => ({
        session_id: sessionId,
        student_id: s.studentId,
        first_join_at: iso(s.firstJoinAt),
        exit_at: iso(s.exitAt),
        exit_source: s.exitSource,
        status: s.status,
        minutes: s.minutes,
        pause_minutes: s.pauseMinutes,
        joins: s.joins,
        moodle_name: s.moodleName,
      }))
    if (upserts.length) {
      const { error } = await db.from('fad_attendance').upsert(upserts, { onConflict: 'session_id,student_id' })
      if (error) throw error
      rows += upserts.length
    }
    // Alunni non più nel corso quel giorno (ritirati, trasferiti, tolti): via le righe calcolate
    const inDay = d.students.map((s) => s.studentId)
    let stale = db.from('fad_attendance').delete().eq('session_id', sessionId).eq('manual', false)
    if (inDay.length) stale = stale.not('student_id', 'in', `(${inDay.join(',')})`)
    const { error: staleError } = await stale
    if (staleError) throw staleError
    for (const o of d.others) unmatched.add(o.name)
  }
  return { days: days.length, rows, keptManual, unmatched: [...unmatched].sort() }
}
