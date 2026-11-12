import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { isPresent } from './attendance.ts'
import { moodleAccountEmail, moodleUsername } from './moodleAccount.ts'
import { moodleCall, moodleCategoryId, moodleShortname, unixTime } from './moodle.ts'

const STUDENT_ROLE = 5
const TEACHER_ROLE = 3

interface PersonRow {
  id: string
  first_name: string
  last_name: string
  email: string
  fad_email: string
  fad_password: string
}

interface CourseRow {
  id: string
  name: string
  edition: string
  code: string
  notes: string
  start_date: string | null
  end_date: string | null
  moodle_course_id: number | null
  moodle_bbb_id: number | null
  moodle_shortname: string
}

interface EventRow {
  id: string
  title: string
  starts_at: string
  ends_at: string
  notes: string
  moodle_event_id: number | null
}

interface MoodleUser {
  id: number
  username: string
}

interface AttendanceRow {
  username: string
  joined: number
  left: number
  minutes: number
}

export interface SyncFadResult {
  moodleCourseId: number
  bbbInstanceId: number | null
  enrolled: number
  createdUsers: number
  /** Account della Regione iscritto come alunno, per poter assistere alle lezioni. */
  regionEnrolled: boolean
  events: number
  attendance: number
  skipped: { name: string; reason: string }[]
  warning: string
}

export async function syncFadCourse(
  db: SupabaseClient,
  courseId: string,
): Promise<SyncFadResult> {
  const course = await loadCourse(db, courseId)
  const shortname = course.moodle_shortname || moodleShortname(course.code, course.edition, course.id)
  const room = await ensureMoodleCourse(course, shortname)
  const skipped: SyncFadResult['skipped'] = []
  const people = await loadPeople(db, courseId)
  const { enrolled, createdUsers } = await enrolPeople(room.courseid, people, skipped)
  const regionEnrolled = await enrolRegionAccount(room.courseid, skipped)
  const events = await syncEvents(db, courseId, room.courseid)
  const attendance = room.bbbinstanceid
    ? await syncAttendance(db, courseId, room.bbbinstanceid, people)
    : 0

  const { error } = await db
    .from('courses')
    .update({
      moodle_course_id: room.courseid,
      moodle_bbb_id: room.bbbinstanceid,
      moodle_shortname: shortname,
    })
    .eq('id', courseId)
  if (error) throw error

  return {
    moodleCourseId: room.courseid,
    bbbInstanceId: room.bbbinstanceid,
    enrolled,
    createdUsers,
    regionEnrolled,
    events,
    attendance,
    skipped,
    warning: room.warning,
  }
}

async function loadCourse(db: SupabaseClient, courseId: string): Promise<CourseRow> {
  const { data, error } = await db.from('courses').select('*').eq('id', courseId).single()
  if (error) throw error
  return data as CourseRow
}

async function ensureMoodleCourse(
  course: CourseRow,
  shortname: string,
): Promise<{ courseid: number; bbbinstanceid: number | null; warning: string }> {
  try {
    const created = await moodleCall<{
      courseid: number
      bbbinstanceid: number
    }>('local_cambiamenti_create_fad_course', {
      fullname: courseLabel(course),
      shortname,
      summary: course.notes,
      startdate: unixTime(course.start_date),
      enddate: unixTime(course.end_date),
    })
    return { courseid: created.courseid, bbbinstanceid: created.bbbinstanceid, warning: '' }
  } catch (error) {
    const code = (error as { errorcode?: string }).errorcode ?? ''
    if (code !== 'accessexception' && code !== 'invalidrecord') throw error
  }

  const courseid = await ensureCoreCourse(course, shortname)
  return {
    courseid,
    bbbinstanceid: course.moodle_bbb_id,
    warning:
      'Corso, iscrizioni e calendario sono su Moodle. La stanza BigBlueButton e le presenze restano in attesa: Aruba blocca l’attivazione del plugin perché max_input_vars è sotto 5000.',
  }
}

async function ensureCoreCourse(course: CourseRow, shortname: string): Promise<number> {
  const fields = {
    fullname: courseLabel(course),
    shortname,
    summary: course.notes,
    startdate: unixTime(course.start_date),
    enddate: unixTime(course.end_date),
  }
  if (course.moodle_course_id) {
    await moodleCall('core_course_update_courses', {
      'courses[0][id]': course.moodle_course_id,
      'courses[0][fullname]': fields.fullname,
      'courses[0][summary]': fields.summary,
      'courses[0][startdate]': fields.startdate,
      'courses[0][enddate]': fields.enddate,
    })
    return course.moodle_course_id
  }
  const created = await moodleCall<Array<{ id: number }>>('core_course_create_courses', {
    'courses[0][fullname]': fields.fullname,
    'courses[0][shortname]': fields.shortname,
    'courses[0][categoryid]': moodleCategoryId(),
    'courses[0][summary]': fields.summary,
    'courses[0][startdate]': fields.startdate,
    'courses[0][enddate]': fields.enddate,
    'courses[0][visible]': 1,
  })
  const id = created[0]?.id
  if (!id) throw new Error('Moodle non ha restituito il corso')
  return id
}

async function loadPeople(
  db: SupabaseClient,
  courseId: string,
): Promise<Array<{ person: PersonRow; roleid: number }>> {
  const [{ data: students, error: studentError }, { data: teachers, error: teacherError }] =
    await Promise.all([
      db.from('course_students').select('person:students(id, first_name, last_name, email, fad_email, fad_password)').eq('course_id', courseId).eq('status', 'attivo'),
      db.from('course_staff').select('person:people(id, first_name, last_name, email, fad_email, fad_password)').eq('course_id', courseId).eq('role', 'teacher'),
    ])
  if (studentError) throw studentError
  if (teacherError) throw teacherError
  const rows: Array<{ person: PersonRow; roleid: number }> = []
  for (const row of (students ?? []) as unknown as Array<{ person: PersonRow | null }>) {
    if (row.person) rows.push({ person: row.person, roleid: STUDENT_ROLE })
  }
  for (const row of (teachers ?? []) as unknown as Array<{ person: PersonRow | null }>) {
    if (row.person) rows.push({ person: row.person, roleid: TEACHER_ROLE })
  }
  return rows
}

async function enrolPeople(
  courseid: number,
  people: Array<{ person: PersonRow; roleid: number }>,
  skipped: SyncFadResult['skipped'],
): Promise<{ enrolled: number; createdUsers: number }> {
  let enrolled = 0
  let createdUsers = 0
  for (const entry of people) {
    const name = `${entry.person.last_name} ${entry.person.first_name}`.trim()
    const username = moodleUsername(entry.person.fad_email, entry.person.email)
    if (!username) {
      skipped.push({ name, reason: 'Username FAD mancante' })
      continue
    }
    let user = await findMoodleUser(username, entry.person.email)
    if (!user) {
      const password = entry.person.fad_password.trim()
      const email = moodleAccountEmail(username, entry.person.email)
      if (!password) {
        skipped.push({ name, reason: 'Password FAD mancante' })
        continue
      }
      if (!email) {
        skipped.push({ name, reason: 'Email Moodle mancante' })
        continue
      }
      try {
        const made = await moodleCall<Array<{ id: number }>>('core_user_create_users', {
          'users[0][username]': username,
          'users[0][password]': password,
          'users[0][firstname]': entry.person.first_name.trim() || 'Nome',
          'users[0][lastname]': entry.person.last_name.trim() || 'Cognome',
          'users[0][email]': email,
          'users[0][auth]': 'manual',
          'users[0][lang]': 'it',
        })
        const id = made[0]?.id
        if (!id) throw new Error('Moodle non ha restituito l’utente')
        user = { id, username }
        createdUsers += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Creazione utente non riuscita'
        skipped.push({ name, reason: message })
        continue
      }
    }
    try {
      await moodleCall('enrol_manual_enrol_users', {
        'enrolments[0][roleid]': entry.roleid,
        'enrolments[0][userid]': user.id,
        'enrolments[0][courseid]': courseid,
      })
      enrolled += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Iscrizione non riuscita'
      if (/already|già iscrit/i.test(message)) enrolled += 1
      else skipped.push({ name, reason: message })
    }
  }
  return { enrolled, createdUsers }
}

/** Username Moodle dell'account della Regione Calabria (già presente su Moodle). */
export const REGION_USERNAME_DEFAULT = 'regionecalabria'

async function enrolRegionAccount(
  courseid: number,
  skipped: SyncFadResult['skipped'],
): Promise<boolean> {
  const username = (Deno.env.get('MOODLE_REGION_USERNAME') || REGION_USERNAME_DEFAULT).trim().toLowerCase()
  if (!username) return false
  try {
    const users = await moodleCall<MoodleUser[]>('core_user_get_users_by_field', {
      field: 'username',
      'values[0]': username,
    })
    const user = users[0]
    if (!user) {
      skipped.push({ name: 'Account Regione', reason: `Utente Moodle «${username}» non trovato` })
      return false
    }
    await moodleCall('enrol_manual_enrol_users', {
      'enrolments[0][roleid]': STUDENT_ROLE,
      'enrolments[0][userid]': user.id,
      'enrolments[0][courseid]': courseid,
    })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Iscrizione non riuscita'
    if (/already|già iscrit/i.test(message)) return true
    skipped.push({ name: 'Account Regione', reason: message })
    return false
  }
}

async function findMoodleUser(username: string, email: string): Promise<MoodleUser | null> {
  const byName = await moodleCall<MoodleUser[]>('core_user_get_users_by_field', {
    field: 'username',
    'values[0]': username,
  })
  if (byName[0]) return byName[0]
  const accountEmail = moodleAccountEmail(username, email)
  if (!accountEmail || accountEmail === username) return null
  const byEmail = await moodleCall<MoodleUser[]>('core_user_get_users_by_field', {
    field: 'email',
    'values[0]': accountEmail,
  })
  return byEmail[0] ?? null
}

async function syncEvents(db: SupabaseClient, courseId: string, moodleCourseId: number): Promise<number> {
  const { data, error } = await db
    .from('calendar_events')
    .select('id, title, starts_at, ends_at, notes, moodle_event_id')
    .eq('course_id', courseId)
    .order('starts_at')
  if (error) throw error
  let count = 0
  for (const event of (data ?? []) as EventRow[]) {
    if (event.moodle_event_id) {
      try {
        await moodleCall('core_calendar_delete_calendar_events', {
          'events[0][eventid]': event.moodle_event_id,
          'events[0][repeat]': 0,
        })
      } catch {
        /* l'evento può essere già stato rimosso */
      }
    }
    const start = unixTime(event.starts_at)
    const end = unixTime(event.ends_at)
    const created = await moodleCall<{ events: Array<{ id: number }> }>(
      'core_calendar_create_calendar_events',
      {
        'events[0][name]': event.title || 'Lezione',
        'events[0][description]': event.notes,
        'events[0][courseid]': moodleCourseId,
        'events[0][timestart]': start,
        'events[0][timeduration]': Math.max(0, end - start),
        'events[0][eventtype]': 'course',
      },
    )
    const moodleEventId = created.events?.[0]?.id
    if (!moodleEventId) continue
    const updated = await db
      .from('calendar_events')
      .update({ moodle_event_id: moodleEventId })
      .eq('id', event.id)
    if (updated.error) throw updated.error
    count += 1
  }
  return count
}

async function syncAttendance(
  db: SupabaseClient,
  courseId: string,
  bbbInstanceId: number,
  people: Array<{ person: PersonRow; roleid: number }>,
): Promise<number> {
  const { data, error } = await db
    .from('calendar_events')
    .select('id, title, starts_at, ends_at, notes, moodle_event_id')
    .eq('course_id', courseId)
  if (error) throw error
  const byUsername = new Map<string, string>()
  for (const entry of people) {
    const username = moodleUsername(entry.person.fad_email, entry.person.email)
    if (username) byUsername.set(username, entry.person.id)
  }
  let saved = 0
  for (const event of (data ?? []) as EventRow[]) {
    const rows = await moodleCall<AttendanceRow[]>('local_cambiamenti_get_session_attendance', {
      bbbinstanceid: bbbInstanceId,
      starts: unixTime(event.starts_at),
      ends: unixTime(event.ends_at),
    })
    for (const row of rows) {
      const personId = byUsername.get(row.username.toLowerCase())
      if (!personId) continue
      const present = isPresent(row.minutes, event.starts_at, event.ends_at)
      const upsert = await db.from('lesson_attendance').upsert(
        {
          calendar_event_id: event.id,
          person_id: personId,
          joined_at: new Date(row.joined * 1000).toISOString(),
          left_at: new Date(row.left * 1000).toISOString(),
          minutes: row.minutes,
          present,
          moodle_username: row.username,
        },
        { onConflict: 'calendar_event_id,person_id' },
      )
      if (upsert.error) throw upsert.error
      saved += 1
    }
  }
  return saved
}

function courseLabel(course: CourseRow): string {
  return course.edition ? `${course.name} · ${course.edition}` : course.name
}

/** Mezzanotte (ora italiana, approssimata a CET) del giorno indicato, in secondi Unix. */
function dayStart(day: string | null): number {
  if (!day) return 0
  const ms = Date.parse(`${day.slice(0, 10)}T00:00:00+01:00`)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0
}

export interface StudentEnrolmentResult {
  done: boolean
  message: string
}

/**
 * Riporta su Moodle lo stato dell'iscrizione di un alunno a un corso:
 * attivo = accesso dal giorno di inizio (enrolled_on) senza scadenza;
 * ritirato o trasferito = accesso fino al giorno di uscita (left_on). L'iscrizione
 * non viene mai cancellata, così i log delle lezioni seguite restano su Moodle.
 */
export async function syncStudentEnrolment(
  db: SupabaseClient,
  courseId: string,
  studentId: string,
): Promise<StudentEnrolmentResult> {
  const course = await loadCourse(db, courseId)
  if (!course.moodle_course_id) return { done: false, message: 'Corso non collegato a Moodle' }

  const { data, error } = await db
    .from('course_students')
    .select('status, enrolled_on, left_on, person:students(id, first_name, last_name, email, fad_email, fad_password)')
    .eq('course_id', courseId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  const row = data as unknown as {
    status: string
    enrolled_on: string | null
    left_on: string | null
    person: PersonRow | null
  } | null
  if (!row?.person) return { done: false, message: 'Alunno non iscritto al corso' }

  const person = row.person
  const name = `${person.last_name} ${person.first_name}`.trim()
  const active = row.status === 'attivo'
  let user: MoodleUser | null
  if (active) {
    const skipped: SyncFadResult['skipped'] = []
    await enrolPeople(course.moodle_course_id, [{ person, roleid: STUDENT_ROLE }], skipped)
    if (skipped.length) return { done: false, message: `${name}: ${skipped[0].reason}` }
    const username = moodleUsername(person.fad_email, person.email)
    user = username ? await findMoodleUser(username, person.email) : null
  } else {
    const username = moodleUsername(person.fad_email, person.email)
    user = username ? await findMoodleUser(username, person.email) : null
    if (!user) return { done: true, message: `${name} non ha un account Moodle: nulla da chiudere` }
  }
  if (!user) return { done: false, message: `${name}: account Moodle non trovato` }

  await moodleCall('enrol_manual_enrol_users', {
    'enrolments[0][roleid]': STUDENT_ROLE,
    'enrolments[0][userid]': user.id,
    'enrolments[0][courseid]': course.moodle_course_id,
    'enrolments[0][timestart]': dayStart(row.enrolled_on),
    'enrolments[0][timeend]': active ? 0 : dayStart(row.left_on),
    'enrolments[0][suspend]': 0,
  })
  return {
    done: true,
    message: active
      ? `${name} iscritto su Moodle${row.enrolled_on ? ` dal ${row.enrolled_on.split('-').reverse().join('/')}` : ''}`
      : `${name}: accesso su Moodle fino al ${row.left_on ? row.left_on.split('-').reverse().join('/') : 'giorno di uscita'} (log conservati)`,
  }
}
