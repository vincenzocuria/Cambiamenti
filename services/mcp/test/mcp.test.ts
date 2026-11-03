import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMcpHandler } from 'agents/mcp/server'
import type { Env } from '../src/env'
import { createGestionaleMcp } from '../src/mcp/server'
import { courseIter } from '../src/mcp/iter'
import { appendNote } from '../src/mcp/tools/modifiche'
import { searchTerm } from '../src/mcp/context'
import { decryptText, encryptText } from '../src/lib/crypto'

const env = {
  SUPABASE_URL: 'https://sb.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
} as Env
const auth = { grantId: 'g', userId: 'u1', email: 'a@b.it', supabaseJwt: 'jwt-utente' }

async function rpc(method: string, params: Record<string, unknown>, id = 1) {
  const handler = createMcpHandler(() => createGestionaleMcp(env, auth), { route: '/mcp' })
  const res = await handler(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Host: 'localhost',
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }),
    env,
    { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext,
  )
  const body = await res.text()
  const json = body.startsWith('{') ? body : body.split('\n').find((l) => l.startsWith('data:'))!.slice(5)
  return JSON.parse(json) as { result?: Record<string, unknown>; error?: unknown }
}

describe('server MCP', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('elenca gli strumenti, senza strumenti di cancellazione', async () => {
    const out = await rpc('tools/list', {})
    const names = (out.result!.tools as { name: string }[]).map((t) => t.name).sort()
    expect(names).toEqual(
      [
        'aggiorna_corso',
        'allega_pec_a_corso',
        'leggi_allegato_pec',
        'leggi_pec',
        'posta_da_elaborare',
        'segna_pec',
        'aggiungi_lezione',
        'aggiungi_nota_corso',
        'cambia_stato_corso',
        'carica_documento',
        'cerca_corsi',
        'cerca_persone',
        'collega_documento',
        'crea_corso',
        'leggi_documento',
        'prepara_caricamento',
        'registra_documento',
        'registra_pagamento',
        'registro_modifiche',
        'scadenze',
        'scheda_corso',
        'situazione_pagamenti',
      ].sort(),
    )
    expect(names.some((n) => /elimina|cancella|delete/.test(n))).toBe(false)
  })

  it('cerca_corsi interroga PostgREST con il JWT dell’utente', async () => {
    const calls: { url: string; auth: string | null }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const req = new Request(input, init)
        calls.push({ url: req.url, auth: req.headers.get('authorization') })
        return Response.json([{ id: 'c1', name: 'Corso', edition: 'ED1 - 2026', status: 'in_corso' }])
      }),
    )
    const out = await rpc('tools/call', { name: 'cerca_corsi', arguments: { testo: '673.7, (x)', stato: 'in_corso' } })
    const content = (out.result!.content as { text: string }[])[0].text
    expect(JSON.parse(content).trovati).toBe(1)
    expect(calls[0].auth).toBe('Bearer jwt-utente')
    const url = decodeURIComponent(calls[0].url)
    expect(url).toContain('/rest/v1/courses')
    expect(url).toContain('status=eq.in_corso')
    expect(url).toContain('or=(and(or(name.ilike.*673.7*,edition.ilike.*673.7*,code.ilike.*673.7*,cup.ilike.*673.7*),or(name.ilike.*x*')
  })
})

describe('iter del corso', () => {
  const base = {
    status: 'finito',
    cup: null,
    code: '673.7',
    funding_program: 'GOL',
    funding_decree: null,
    start_date: '2026-01-10',
    end_date: '2026-03-10',
    duration_hours: 150,
    staff: 3,
    students: 12,
    lessons: 40,
    reportLines: 0,
    balanceToReceive: null,
    documents: 2,
  }
  it('corso finito senza verbale: il prossimo passo è il verbale', () => {
    const r = courseIter(base, '2026-11-03')
    expect(r.fasi.find((f) => f.fase === 'CUP')!.stato).toBe('facoltativo')
    expect(r.prossimo_passo).toMatch(/verbale/i)
  })
  it('verbale caricato e saldo incassato: resta la chiusura', () => {
    const r = courseIter({ ...base, status: 'rendicontato', reportLines: 1, balanceToReceive: 0 }, '2026-11-03')
    expect(r.prossimo_passo).toMatch(/Chiusura/)
  })
})

describe('utilità', () => {
  it('appendNote aggiunge una riga datata', () => {
    expect(appendNote(null, 'ciao', '2026-11-03')).toBe('[2026-11-03] ciao')
    expect(appendNote('vecchia', 'nuova', '2026-11-03')).toBe('vecchia\n[2026-11-03] nuova')
  })
  it('searchTerm toglie i caratteri speciali di PostgREST', () => {
    expect(searchTerm('a,b(c)*%')).toBe('a b c')
  })
  it('cifratura AES-GCM reversibile e non in chiaro', async () => {
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)))
    const enc = await encryptText(key, 'segreto')
    expect(enc).not.toContain('segreto')
    expect(await decryptText(key, enc)).toBe('segreto')
  })
})
