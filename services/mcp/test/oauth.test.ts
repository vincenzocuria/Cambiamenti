import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateBearer, UnauthorizedError } from '../src/auth/session'
import type { Env } from '../src/env'
import { bytesToBase64Url } from '../src/lib/crypto'
import { handleOAuth, isAllowedRedirectUri, redirectUriMatches } from '../src/oauth/oauth'
import { fakeD1 } from './d1'

const ORIGIN = 'https://mcp.example.test'
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'

function makeEnv(): Env {
  return {
    DB: fakeD1(),
    SUPABASE_URL: 'https://sb.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    CAMBIAMENTI_MCP_TOKEN_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
    APP_ORIGIN: ORIGIN,
  }
}

let role = 'staff'
let refreshCount = 0

function mockSupabase() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/v1/token?grant_type=password')) {
        const body = JSON.parse(String(init?.body))
        if (body.password !== 'giusta') return new Response('{}', { status: 400 })
        return Response.json({ access_token: 'sb-access-1', refresh_token: 'sb-refresh-1', expires_in: 3600, user: { id: 'u1', email: body.email } })
      }
      if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
        refreshCount++
        return Response.json({ access_token: `sb-access-r${refreshCount}`, refresh_token: `sb-refresh-r${refreshCount}`, expires_in: 3600, user: { id: 'u1', email: 'a@b.it' } })
      }
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role }])
      if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 })
      throw new Error(`fetch inatteso: ${url}`)
    }),
  )
}

async function pkcePair() {
  const verifier = 'v'.repeat(50)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return { verifier, challenge: bytesToBase64Url(digest) }
}

async function call(env: Env, path: string, init: RequestInit = {}) {
  const res = await handleOAuth(new Request(`${ORIGIN}${path}`, init), env)
  if (!res) throw new Error('rotta non gestita')
  return res
}

async function register(env: Env) {
  const res = await call(env, '/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT] }),
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { client_id: string }).client_id
}

async function authorize(env: Env, clientId: string, challenge: string, password = 'giusta') {
  const query = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'st' })
  const page = await call(env, `/oauth/authorize?${query}`)
  expect(page.status).toBe(200)
  const csrf = /cm_mcp_oauth_csrf=([0-9a-f]+)/.exec(page.headers.get('set-cookie') ?? '')![1]
  const form = new URLSearchParams({ ...Object.fromEntries(query), csrf, decision: 'allow', email: 'Staff@Cambiamenti.it', password })
  return call(env, '/oauth/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: `cm_mcp_oauth_csrf=${csrf}` },
    body: form,
  })
}

async function tokenRequest(env: Env, params: Record<string, string>) {
  return call(env, '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) })
}

describe('OAuth del connettore', () => {
  beforeEach(() => {
    role = 'staff'
    refreshCount = 0
    mockSupabase()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('pubblica i metadati', async () => {
    const env = makeEnv()
    const meta = (await (await call(env, '/.well-known/oauth-authorization-server')).json()) as Record<string, unknown>
    expect(meta.token_endpoint).toBe(`${ORIGIN}/oauth/token`)
    const res = (await (await call(env, '/.well-known/oauth-protected-resource/mcp')).json()) as Record<string, unknown>
    expect(res.resource).toBe(`${ORIGIN}/mcp`)
  })

  it('flusso completo: login staff, codice, token, accesso a /mcp, refresh con rotazione', async () => {
    const env = makeEnv()
    const clientId = await register(env)
    const { verifier, challenge } = await pkcePair()
    const back = await authorize(env, clientId, challenge)
    expect(back.status).toBe(302)
    const loc = new URL(back.headers.get('location')!)
    expect(loc.origin + loc.pathname).toBe(REDIRECT)
    expect(loc.searchParams.get('state')).toBe('st')
    const code = loc.searchParams.get('code')!

    // PKCE sbagliato: rifiutato senza consumare il codice
    const bad = await tokenRequest(env, { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: 'x'.repeat(50), redirect_uri: REDIRECT })
    expect(bad.status).toBe(400)

    const tok = await tokenRequest(env, { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier, redirect_uri: REDIRECT })
    expect(tok.status).toBe(200)
    const t = (await tok.json()) as { access_token: string; refresh_token: string; expires_in: number }
    expect(t.access_token).toMatch(/^cma_/)
    expect(t.expires_in).toBe(3600)

    const auth = await authenticateBearer(env, `Bearer ${t.access_token}`)
    expect(auth).toMatchObject({ userId: 'u1', supabaseJwt: 'sb-access-1' })

    // La sessione Supabase in D1 non è in chiaro
    const row = await env.DB.prepare('SELECT sb_session_enc FROM oauth_grants').first<{ sb_session_enc: string }>()
    expect(row!.sb_session_enc).not.toContain('sb-refresh-1')

    // Codice riusato -> rifiutato e concessione revocata
    const again = await tokenRequest(env, { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier })
    expect(again.status).toBe(400)
    await expect(authenticateBearer(env, `Bearer ${t.access_token}`)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('refresh: ruota i token, ricontrolla il ruolo e blocca il riuso tardivo', async () => {
    const env = makeEnv()
    const clientId = await register(env)
    const { verifier, challenge } = await pkcePair()
    const code = new URL((await authorize(env, clientId, challenge)).headers.get('location')!).searchParams.get('code')!
    const first = (await (await tokenRequest(env, { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier })).json()) as {
      access_token: string
      refresh_token: string
    }
    const r1 = await tokenRequest(env, { grant_type: 'refresh_token', client_id: clientId, refresh_token: first.refresh_token })
    expect(r1.status).toBe(200)
    const second = (await r1.json()) as { access_token: string; refresh_token: string }
    expect(second.refresh_token).not.toBe(first.refresh_token)
    await expect(authenticateBearer(env, `Bearer ${first.access_token}`)).rejects.toBeInstanceOf(UnauthorizedError)
    expect((await authenticateBearer(env, `Bearer ${second.access_token}`)).supabaseJwt).toBe('sb-access-r1')

    // Utente non più staff: il refresh revoca l'accesso
    role = 'student'
    const r2 = await tokenRequest(env, { grant_type: 'refresh_token', client_id: clientId, refresh_token: second.refresh_token })
    expect(r2.status).toBe(400)
    await expect(authenticateBearer(env, `Bearer ${second.access_token}`)).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rifiuta password errata e utenti non staff', async () => {
    const env = makeEnv()
    const clientId = await register(env)
    const { challenge } = await pkcePair()
    expect((await authorize(env, clientId, challenge, 'sbagliata')).status).toBe(401)
    role = 'student'
    const res = await authorize(env, clientId, challenge)
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('non ha accesso')
  })

  it('token assente o inventato -> 401', async () => {
    const env = makeEnv()
    await expect(authenticateBearer(env, null)).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(authenticateBearer(env, 'Bearer cma_inventato')).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('redirect ammessi', () => {
    expect(isAllowedRedirectUri('https://claude.ai/cb')).toBe(true)
    expect(isAllowedRedirectUri('http://evil.example/cb')).toBe(false)
    expect(isAllowedRedirectUri('http://localhost:3000/cb')).toBe(true)
    expect(redirectUriMatches(['http://127.0.0.1:1234/cb'], 'http://127.0.0.1:9999/cb')).toBe(true)
    expect(redirectUriMatches(['https://claude.ai/cb'], 'https://claude.ai/other')).toBe(false)
  })
})
