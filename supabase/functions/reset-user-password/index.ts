import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from './cors.ts'
import { parseResetBody } from './parseBody.ts'
import { canResetPassword } from './canReset.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
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

    const { data: actor, error: actorError } = await caller
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle()
    if (actorError) throw actorError
    if (!actor) return jsonResponse({ error: 'Profilo non trovato' }, 403)

    const body = parseResetBody(await req.json())
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, role, email')
      .eq('id', body.userId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) return jsonResponse({ error: 'Utente non trovato' }, 404)

    if (
      !canResetPassword({
        actorRole: actor.role,
        actorEmail: actor.email,
        targetRole: target.role,
        targetEmail: target.email,
      })
    ) {
      return jsonResponse({ error: 'Non puoi reimpostare la password di questo utente' }, 403)
    }

    if (body.mode === 'email') {
      const { error } = await admin.auth.resetPasswordForEmail(target.email, {
        redirectTo: body.redirectTo,
      })
      if (error) throw error
      return jsonResponse({ ok: true, mode: 'email' })
    }

    const { error } = await admin.auth.admin.updateUserById(target.id, { password: body.password })
    if (error) throw error
    return jsonResponse({ ok: true, mode: 'direct' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore reset password'
    return jsonResponse({ error: message }, 400)
  }
})
