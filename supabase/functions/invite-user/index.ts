import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeadersForRequest } from './cors.ts'
import { isSuperAdminEmail, jsonResponse } from '../_shared/securityConfig.ts'
import { parseInviteBody } from './parseBody.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeadersForRequest(req) })
  }

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405, origin)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: 'Configurazione server mancante' }, 500, origin)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Non autenticato' }, 401, origin)

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Sessione non valida' }, 401, origin)

    const { data: profile, error: profileError } = await caller
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile || (profile.role !== 'superadmin' && profile.role !== 'admin')) {
      return jsonResponse({ error: 'Solo admin possono invitare utenti' }, 403, origin)
    }

    const body = parseInviteBody(await req.json())
    if (isSuperAdminEmail(body.email)) {
      return jsonResponse({ error: 'Questa email non è disponibile' }, 400, origin)
    }
    if (body.role === 'admin' && profile.role !== 'superadmin') {
      return jsonResponse({ error: 'Non puoi assegnare questo ruolo' }, 403, origin)
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
    if (!invited.user) return jsonResponse({ error: 'Invito non creato' }, 500, origin)

    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: body.role, full_name: body.fullName, email: body.email })
      .eq('id', invited.user.id)
    if (roleError) throw roleError

    return jsonResponse({ ok: true, userId: invited.user.id }, 200, origin)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore invito'
    return jsonResponse({ error: message }, 400, origin)
  }
})
