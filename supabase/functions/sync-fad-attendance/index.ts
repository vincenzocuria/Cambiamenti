import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../send-fad-credentials/cors.ts'
import { MoodleWebSession } from './moodleWeb.ts'
import { parseReportLog } from './reportCsv.ts'
import { recompute, saveEvents } from './persist.ts'

type Action = 'sync' | 'recompute' | 'courses' | 'sync_all'

/** Il sync notturno legge i corsi collegati a Moodle finiti da non più di questi giorni. */
const NIGHTLY_DAYS_AFTER_END = 45

function parseBody(body: unknown): { action: Action; courseId: string } {
  if (!body || typeof body !== 'object') throw new Error('Richiesta non valida')
  const b = body as { action?: unknown; courseId?: unknown }
  const action = (typeof b.action === 'string' ? b.action : 'sync') as Action
  if (!['sync', 'recompute', 'courses', 'sync_all'].includes(action)) throw new Error('Azione non valida')
  const courseId = typeof b.courseId === 'string' ? b.courseId.trim() : ''
  if (action !== 'courses' && action !== 'sync_all' && !courseId) throw new Error('Corso mancante')
  return { action, courseId }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey) return jsonResponse({ error: 'Configurazione server mancante' }, 500)

    // Sync notturno: chiamato dal cron con il segreto condiviso
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
      if (!serviceKey) return jsonResponse({ error: 'Configurazione server mancante' }, 500)
      const admin = createClient(supabaseUrl, serviceKey)
      // Con un corso indicato legge solo quello (anche se finito da tempo), altrimenti il giro notturno
      const body = (await req.json().catch(() => ({}))) as { courseId?: unknown }
      if (typeof body.courseId === 'string' && body.courseId.trim()) {
        return jsonResponse(await syncCourse(admin, body.courseId.trim(), MoodleWebSession.fromEnv()))
      }
      return jsonResponse(await syncAll(admin))
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Non autenticato' }, 401)

    const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: userError,
    } = await db.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Sessione non valida' }, 401)
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!['superadmin', 'admin', 'staff'].includes(profile?.role ?? '')) {
      return jsonResponse({ error: 'Non autorizzato' }, 403)
    }

    const { action, courseId } = parseBody(await req.json())

    if (action === 'courses') {
      const moodle = MoodleWebSession.fromEnv()
      return jsonResponse({ courses: await moodle.listCourses() })
    }

    if (action === 'sync_all') return jsonResponse(await syncAll(db))

    if (action === 'recompute') {
      return jsonResponse({ newEvents: 0, ...(await recompute(db, courseId)) })
    }

    return jsonResponse(await syncCourse(db, courseId, MoodleWebSession.fromEnv()))
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Sincronizzazione presenze non riuscita'
    return jsonResponse({ error: message }, 400)
  }
})

async function syncCourse(db: SupabaseClient, courseId: string, moodle: MoodleWebSession) {
  const { data: course, error: courseError } = await db
    .from('courses')
    .select('id, moodle_course_id')
    .eq('id', courseId)
    .single()
  if (courseError) throw courseError
  if (!course.moodle_course_id) throw new Error('Il corso non è collegato a un corso Moodle')
  const csv = await moodle.courseLogCsv(course.moodle_course_id)
  const events = parseReportLog(csv)
  const newEvents = await saveEvents(db, courseId, events)
  const result = await recompute(db, courseId)
  return { newEvents, readEvents: events.length, ...result }
}

async function syncAll(db: SupabaseClient) {
  const since = new Date(Date.now() - NIGHTLY_DAYS_AFTER_END * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await db
    .from('courses')
    .select('id, name, edition')
    .not('moodle_course_id', 'is', null)
    .or(`end_date.is.null,end_date.gte.${since}`)
  if (error) throw error
  const moodle = MoodleWebSession.fromEnv()
  const results: { courseId: string; ok: boolean; message: string }[] = []
  for (const c of data ?? []) {
    try {
      const r = await syncCourse(db, c.id, moodle)
      results.push({ courseId: c.id, ok: true, message: `${r.newEvents} eventi nuovi, ${r.days} giornate` })
    } catch (e) {
      results.push({ courseId: c.id, ok: false, message: e instanceof Error ? e.message : 'errore' })
    }
  }
  return { courses: results.length, results }
}
