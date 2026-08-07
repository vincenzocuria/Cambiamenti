import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from './cors.ts'

const DAYS_AHEAD = 30

interface ExpiringRow {
  id: string
  first_name: string
  last_name: string
  doc_expiry_date: string
  kind: 'student' | 'staff'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: 'Configurazione server mancante' }, 500)
    }

    const headerSecret = req.headers.get('x-cron-secret')
    let authorized = Boolean(cronSecret && headerSecret === cronSecret)

    if (!authorized) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const caller = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        })
        const {
          data: { user },
        } = await caller.auth.getUser()
        if (user) {
          const { data: profile } = await caller
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.role === 'superadmin' || profile?.role === 'admin') {
            authorized = true
          }
        }
      }
    }

    if (!authorized) return jsonResponse({ error: 'Non autorizzato' }, 403)

    const admin = createClient(supabaseUrl, serviceKey)
    const today = new Date()
    const end = new Date(today)
    end.setDate(end.getDate() + DAYS_AHEAD)
    const from = today.toISOString().slice(0, 10)
    const to = end.toISOString().slice(0, 10)

    const [studentsRes, peopleRes] = await Promise.all([
      admin
        .from('students')
        .select('id, first_name, last_name, doc_expiry_date')
        .gte('doc_expiry_date', from)
        .lte('doc_expiry_date', to),
      admin
        .from('people')
        .select('id, first_name, last_name, doc_expiry_date')
        .gte('doc_expiry_date', from)
        .lte('doc_expiry_date', to),
    ])

    if (studentsRes.error) throw studentsRes.error
    if (peopleRes.error) throw peopleRes.error

    const rows: ExpiringRow[] = [
      ...(studentsRes.data ?? []).map((r) => ({ ...r, kind: 'student' as const })),
      ...(peopleRes.data ?? []).map((r) => ({ ...r, kind: 'staff' as const })),
    ]

    if (rows.length === 0) {
      return jsonResponse({ ok: true, count: 0 })
    }

    const lines = rows.map((r) => {
      const name = `${r.last_name} ${r.first_name}`.trim()
      const path = r.kind === 'student' ? `/alunni/${r.id}` : `/personale/${r.id}`
      return `${name} — scade ${r.doc_expiry_date} (${path})`
    })

    const summary = `${rows.length} document${rows.length === 1 ? 'o' : 'i'} scadono entro ${DAYS_AHEAD} giorni.`
    const detail = lines.join('\n')

    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['superadmin', 'admin'])

    for (const a of admins ?? []) {
      const { error: insertError } = await admin.from('notifications').insert({
        user_id: a.id,
        type: 'doc_expiry',
        title: 'Documenti in scadenza',
        body: summary,
        link: '/personale',
      })
      if (insertError) throw insertError
    }

  // Email via send-notification-email logic inline
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      const { data: adminEmails } = await admin
        .from('profiles')
        .select('email')
        .in('role', ['superadmin', 'admin'])

      const recipients = (adminEmails ?? [])
        .map((r) => r.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e))

      if (recipients.length > 0) {
        const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') ?? 'no-reply@vcuria.app'
        const fromName = Deno.env.get('NOTIFICATION_FROM_NAME') ?? 'Cambia-Menti Formazione'
        const origin = Deno.env.get('APP_ORIGIN') ?? 'https://cambiamenti.vcuria.app'

        const html = `
          <div style="font-family:system-ui,sans-serif;color:#1e293b;line-height:1.5">
            <h2 style="margin:0 0 8px;font-size:18px">Documenti in scadenza</h2>
            <p style="margin:0">${summary}</p>
            <ul style="margin:12px 0 0;padding-left:20px">
              ${lines.map((l) => `<li>${l}</li>`).join('')}
            </ul>
            <p style="margin-top:16px"><a href="${origin}/personale" style="color:#4338ca">Apri Cambia-Menti</a></p>
          </div>
        `.trim()

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: recipients,
            subject: 'Documenti in scadenza',
            html,
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Resend: ${text}`)
        }
      }
    }

    return jsonResponse({ ok: true, count: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore controllo scadenze'
    return jsonResponse({ error: message }, 400)
  }
})
