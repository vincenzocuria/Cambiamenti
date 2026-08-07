import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from './cors.ts'
import { parseInviteBody } from './parseBody.ts'

const SUPERADMIN_EMAIL = 'curiavincenzo86@gmail.com'

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

    const { data: profile, error: profileError } = await caller
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile || (profile.role !== 'superadmin' && profile.role !== 'admin')) {
      return jsonResponse({ error: 'Solo admin possono invitare utenti' }, 403)
    }

    const body = parseInviteBody(await req.json())
    if (body.email === SUPERADMIN_EMAIL) {
      return jsonResponse({ error: 'Questa email è riservata al superadmin' }, 400)
    }
    if (body.role === 'admin' && profile.role !== 'superadmin') {
      return jsonResponse({ error: 'Solo il superadmin può creare altri admin' }, 403)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      body.email,
      {
        data: { full_name: body.fullName },
        redirectTo: body.redirectTo,
      },
    )
    if (inviteError) throw inviteError
    if (!invited.user) return jsonResponse({ error: 'Invito non creato' }, 500)

    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: body.role, full_name: body.fullName, email: body.email })
      .eq('id', invited.user.id)
    if (roleError) throw roleError

    return jsonResponse({ ok: true, userId: invited.user.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore invito'
    return jsonResponse({ error: message }, 400)
  }
})
