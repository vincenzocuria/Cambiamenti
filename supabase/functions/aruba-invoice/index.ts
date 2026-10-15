import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from './cors.ts'
import {
  ArubaError,
  arubaLastInvoiceNumber,
  arubaLogin,
  arubaUploadInvoice,
  arubaUserInfo,
} from './aruba.ts'

/**
 * Invio fatture EIPASS ad Aruba Fatturazione Elettronica.
 * Solo utenti staff. Credenziali nei secrets ARUBA_FE_USERNAME / ARUBA_FE_PASSWORD.
 * - action "check": verifica che il login ad Aruba funzioni
 * - action "lastNumber": numero più alto delle fatture emesse su Aruba nell'anno
 * - action "send": carica l'XML su Aruba e segna il corsista come fatturato
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const username = Deno.env.get('ARUBA_FE_USERNAME')
    const password = Deno.env.get('ARUBA_FE_PASSWORD')
    if (!supabaseUrl || !anonKey) return jsonResponse({ error: 'Configurazione server mancante' }, 500)
    if (!username || !password) {
      return jsonResponse({ error: 'Credenziali Aruba non configurate sul server' }, 500)
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      candidateId?: string
      xml?: string
      year?: number
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
    const role = (profile as { role?: string } | null)?.role
    if (role !== 'superadmin' && role !== 'admin' && role !== 'staff') {
      return jsonResponse({ error: 'Non autorizzato' }, 403)
    }

    const token = await arubaLogin(username, password)

    if (body.action === 'check') {
      const info = await arubaUserInfo(token)
      // Solo campi non sensibili per confermare l'account collegato
      return jsonResponse({
        ok: true,
        account: info.username ?? info.userName ?? null,
        vatCode: info.vatCode ?? null,
        description: info.description ?? null,
      })
    }

    if (body.action === 'lastNumber') {
      const year = Number(body.year) || new Date().getFullYear()
      const info = await arubaUserInfo(token)
      const arubaUser = String(info.username ?? info.userName ?? username)
      const result = await arubaLastInvoiceNumber(token, arubaUser, year, {
        countryCode: 'IT',
        vatCode: String(info.vatCode ?? ''),
      })
      return jsonResponse({ ok: true, year, ...result })
    }

    if (body.action === 'send') {
      const xml = body.xml?.trim()
      if (!body.candidateId || !xml?.startsWith('<?xml')) {
        return jsonResponse({ error: 'Fattura o corsista mancanti' }, 400)
      }
      const uploadFileName = await arubaUploadInvoice(token, xml)
      const { error } = await caller
        .from('eipass_candidates')
        .update({ invoice_status: 'fatturato' })
        .eq('id', body.candidateId)
      if (error) throw error
      return jsonResponse({ ok: true, uploadFileName })
    }

    return jsonResponse({ error: 'Azione non valida' }, 400)
  } catch (err) {
    const message =
      err instanceof ArubaError ? err.message : err instanceof Error ? err.message : 'Errore imprevisto'
    console.error('aruba-invoice:', message)
    return jsonResponse({ error: message }, err instanceof ArubaError ? 502 : 500)
  }
})
