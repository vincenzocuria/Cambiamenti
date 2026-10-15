import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from './cors.ts'
import {
  ArubaError,
  type ArubaAccount,
  type ArubaDirection,
  arubaGetInvoiceXml,
  arubaLastInvoiceNumber,
  arubaListInvoices,
  arubaLogin,
  arubaUploadInvoice,
  arubaUserInfo,
} from './aruba.ts'

/**
 * Invio fatture EIPASS ad Aruba Fatturazione Elettronica.
 * Solo utenti staff. Credenziali nei secrets ARUBA_FE_USERNAME / ARUBA_FE_PASSWORD.
 * - action "check": verifica che il login ad Aruba funzioni
 * - action "lastNumber": numero più alto delle fatture emesse su Aruba nell'anno
 * - action "send": carica l'XML su Aruba e segna il corsista (o la fattura) come inviata
 * - action "sync": importa una pagina dell'elenco fatture emesse/ricevute dell'anno
 * - action "file": scarica l'XML di una fattura importata e lo salva
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
      invoiceId?: string
      direction?: string
      page?: number
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

    /** Utente e P.IVA del titolare Aruba, per gli elenchi fatture. */
    async function arubaAccount(): Promise<ArubaAccount> {
      const info = await arubaUserInfo(token)
      return {
        username: String(info.username ?? info.userName ?? username),
        vatCode: String(info.vatCode ?? ''),
        countryCode: String(info.countryCode ?? 'IT') || 'IT',
      }
    }

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
      const result = await arubaLastInvoiceNumber(token, await arubaAccount(), year)
      return jsonResponse({ ok: true, year, ...result })
    }

    if (body.action === 'send') {
      const xml = body.xml?.trim()
      if ((!body.candidateId && !body.invoiceId) || !xml?.startsWith('<?xml')) {
        return jsonResponse({ error: 'Fattura o corsista mancanti' }, 400)
      }
      const uploadFileName = await arubaUploadInvoice(token, xml)
      if (body.candidateId) {
        const { error } = await caller
          .from('eipass_candidates')
          .update({ invoice_status: 'fatturato' })
          .eq('id', body.candidateId)
        if (error) throw error
      }
      if (body.invoiceId) {
        const { error } = await caller
          .from('invoices')
          .update({ status: 'sent', aruba_filename: uploadFileName || null, xml })
          .eq('id', body.invoiceId)
        if (error) throw error
      }
      return jsonResponse({ ok: true, uploadFileName })
    }

    const direction: ArubaDirection | null =
      body.direction === 'out' || body.direction === 'in' ? body.direction : null

    if (body.action === 'sync') {
      if (!direction) return jsonResponse({ error: 'Direzione non valida' }, 400)
      const year = Number(body.year) || new Date().getFullYear()
      const page = Math.max(1, Number(body.page) || 1)
      const { items, last } = await arubaListInvoices(token, direction, await arubaAccount(), year, page)

      let added = 0
      let updated = 0
      for (const h of items) {
        const header = {
          sdi_id: h.sdiId,
          sdi_status: h.status,
          sdi_status_label: h.statusLabel,
        }
        // Già presente con lo stesso file Aruba?
        const { data: byFile, error: e1 } = await caller
          .from('invoices')
          .select('id')
          .eq('direction', direction)
          .eq('aruba_filename', h.filename)
          .maybeSingle()
        if (e1) throw e1
        let existingId = byFile?.id as string | undefined
        // Fattura creata nell'app e inviata: la riconosco da numero e data
        if (!existingId && direction === 'out' && h.number && h.date) {
          const { data: byNumber, error: e2 } = await caller
            .from('invoices')
            .select('id')
            .eq('direction', 'out')
            .eq('number', h.number)
            .eq('invoice_date', h.date)
            .is('aruba_filename', null)
            .limit(1)
            .maybeSingle()
          if (e2) throw e2
          existingId = byNumber?.id as string | undefined
        }
        if (existingId) {
          const { error } = await caller
            .from('invoices')
            .update({ ...header, aruba_filename: h.filename })
            .eq('id', existingId)
          if (error) throw error
          updated++
        } else {
          const { error } = await caller.from('invoices').insert({
            ...header,
            direction,
            status: 'imported',
            aruba_filename: h.filename,
            number: h.number,
            invoice_date: h.date,
            counterpart_name: h.counterpartName,
            counterpart_vat: h.counterpartVat,
            counterpart_tax_code: h.counterpartTaxCode,
          })
          if (error) throw error
          added++
        }
      }
      return jsonResponse({ ok: true, year, page, last, received: items.length, added, updated })
    }

    if (body.action === 'file') {
      if (!body.invoiceId) return jsonResponse({ error: 'Fattura mancante' }, 400)
      const { data: row, error: e1 } = await caller
        .from('invoices')
        .select('direction, aruba_filename')
        .eq('id', body.invoiceId)
        .maybeSingle()
      if (e1) throw e1
      if (!row?.aruba_filename) return jsonResponse({ error: 'Fattura senza file su Aruba' }, 400)
      const xml = await arubaGetInvoiceXml(token, row.direction as ArubaDirection, row.aruba_filename)
      const { error } = await caller.from('invoices').update({ xml }).eq('id', body.invoiceId)
      if (error) throw error
      return jsonResponse({ ok: true, xml })
    }

    return jsonResponse({ error: 'Azione non valida' }, 400)
  } catch (err) {
    const message =
      err instanceof ArubaError
        ? err.message
        : (err as { message?: string } | null)?.message || 'Errore imprevisto'
    console.error('aruba-invoice:', message)
    return jsonResponse({ error: message }, err instanceof ArubaError ? 502 : 500)
  }
})
