import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../send-fad-credentials/cors.ts'
import { parseSyncFadBody } from './parseBody.ts'
import { syncFadCourse } from './sync.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) return jsonResponse({ error: 'Configurazione server mancante' }, 500)

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

    const body = parseSyncFadBody(await req.json())
    const result = await syncFadCourse(caller, body.courseId)
    return jsonResponse(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sincronizzazione FAD non riuscita'
    return jsonResponse({ error: message }, 400)
  }
})
