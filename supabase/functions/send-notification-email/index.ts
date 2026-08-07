import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { fetchAdminEmails, verifyRecentPending } from './adminEmails.ts'
import { corsHeaders, jsonResponse } from './cors.ts'
import { parseEmailBody } from './parseBody.ts'
import { buildHtml, sendViaResend } from './resend.ts'

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

    const body = parseEmailBody(await req.json())
    const admin = createClient(supabaseUrl, serviceKey)
    const authHeader = req.headers.get('Authorization')

    let authorized = false

    if (authHeader) {
      const caller = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user },
        error: userError,
      } = await caller.auth.getUser()
      if (!userError && user) {
        const { data: profile } = await caller
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (profile && (profile.role === 'superadmin' || profile.role === 'admin' || profile.role === 'staff')) {
          authorized = true
        }
      }
    }

    if (!authorized && body.type === 'user_pending' && body.pendingEmail) {
      authorized = await verifyRecentPending(admin, body.pendingEmail)
    }

    if (!authorized) return jsonResponse({ error: 'Non autorizzato' }, 403)

    const recipients = await fetchAdminEmails(admin)
    if (recipients.length === 0) {
      return jsonResponse({ ok: true, skipped: 'no_admins' })
    }

    const origin = Deno.env.get('APP_ORIGIN') ?? 'https://cambiamenti.vcuria.app'
    const html = buildHtml(body.title!, body.body!, body.link ?? '', origin)

    await sendViaResend({
      to: recipients,
      subject: body.title!,
      html,
    })

    return jsonResponse({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore email'
    return jsonResponse({ error: message }, 400)
  }
})
