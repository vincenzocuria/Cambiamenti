import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendViaResend } from '../send-notification-email/resend.ts'
import { corsHeaders, jsonResponse } from './cors.ts'
import { credentialsHtml, credentialsText, destinationEmail, FAD_SHARE_SUBJECT } from './message.ts'
import { parseFadCredentialsBody } from './parseBody.ts'

interface PersonRow {
  id: string
  first_name: string
  last_name: string
  email: string
  fad_email: string
  fad_password: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ error: 'Configurazione server mancante' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Non autenticato' }, 401)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Sessione non valida' }, 401)

    const { data: profile, error: profileError } = await caller
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    const role = profile?.role
    if (role !== 'superadmin' && role !== 'admin' && role !== 'staff') {
      return jsonResponse({ error: 'Non autorizzato' }, 403)
    }

    const body = parseFadCredentialsBody(await req.json())
    const { data, error } = await caller
      .from(body.audience)
      .select('id, first_name, last_name, email, fad_email, fad_password')
      .in('id', body.personIds)
    if (error) throw error

    const byId = new Map((data as PersonRow[]).map((row) => [row.id, row]))
    const skipped: { name: string; reason: string }[] = []
    let sent = 0

    for (const id of body.personIds) {
      const person = byId.get(id)
      if (!person) {
        skipped.push({ name: 'Persona', reason: 'Non trovata' })
        continue
      }
      const name = `${person.last_name} ${person.first_name}`.trim()
      const username = person.fad_email.trim() || person.email.trim()
      const password = person.fad_password.trim()
      if (!username || !password) {
        skipped.push({ name, reason: 'Credenziali FAD incomplete' })
        continue
      }
      const to = destinationEmail(person.email, person.fad_email)
      if (!to) {
        skipped.push({ name, reason: 'Email mancante' })
        continue
      }
      const message = {
        greetingName: person.first_name.trim() || 'ciao',
        username,
        password,
        courseName: body.courseName,
      }
      try {
        await sendViaResend({
          to: [to],
          subject: FAD_SHARE_SUBJECT,
          html: credentialsHtml(message),
          text: credentialsText(message),
        })
        sent += 1
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Invio non riuscito'
        skipped.push({ name, reason })
      }
    }

    return jsonResponse({ ok: true, sent, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore email'
    return jsonResponse({ error: message }, 400)
  }
})
