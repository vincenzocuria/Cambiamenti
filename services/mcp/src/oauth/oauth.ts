// Server di autorizzazione OAuth 2.1 per l'endpoint MCP del gestionale.
//
// Flusso (MCP Authorization spec, compatibile con i connettori di Claude):
//  1. il client chiama /mcp senza token -> 401 con WWW-Authenticate: Bearer resource_metadata="..."
//  2. legge /.well-known/oauth-protected-resource[/mcp] e /.well-known/oauth-authorization-server
//  3. si registra con /oauth/register (Dynamic Client Registration, RFC 7591)
//  4. porta l'utente su /oauth/authorize: login con l'utente del gestionale (Supabase Auth),
//     solo profili staff/admin/superadmin, PKCE S256 obbligatorio
//  5. scambia il codice su /oauth/token: access token opaco (1 ora) + refresh token con rotazione.
// La sessione Supabase dell'utente resta in D1 solo cifrata e serve a chiamare i dati con RLS.

import type { Env } from '../env'
import { encryptText, decryptText, pkceMatches, randomHex, safeEqual, sha256Hex } from '../lib/crypto'
import {
  clientIp,
  corsHeaders,
  html,
  json,
  methodNotAllowed,
  parseCookie,
  readJson,
  redirect,
  withParams,
} from '../lib/http'
import { AuthError, fetchRole, isStaffRole, logout, passwordLogin, refreshSession, type SupabaseSession } from '../auth/supabase'
import { consentPage, errorPage } from './pages'
import { recordAttempt, tooManyAttempts } from './rate-limit'

export const OAUTH_SCOPE = 'gestionale'
export const ACCESS_TTL_MS = 60 * 60 * 1000
const CODE_TTL_MS = 10 * 60 * 1000
const MAX_REDIRECT_URIS = 10
const MAX_REDIRECT_URI_LENGTH = 512
const REFRESH_GRACE_MS = 60 * 1000
const CSRF_COOKIE = 'cm_mcp_oauth_csrf'

export function oauthOrigin(env: Env, request: Request): string {
  const configured = env.APP_ORIGIN?.trim().replace(/\/+$/, '')
  return configured || new URL(request.url).origin
}

export function resourceUrl(origin: string): string {
  return `${origin}/mcp`
}

/** Header WWW-Authenticate per i 401 di /mcp: indica dove trovare i metadati OAuth. */
export function mcpWwwAuthenticate(env: Env, request: Request): string {
  const origin = oauthOrigin(env, request)
  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${OAUTH_SCOPE}"`
}

/** Gestisce le rotte OAuth e .well-known. Restituisce null se il percorso non è suo. */
export async function handleOAuth(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  if (!path.startsWith('/.well-known/oauth-') && !path.startsWith('/oauth/')) return null
  const origin = oauthOrigin(env, request)

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })

  if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed()
    return json({
      resource: resourceUrl(origin),
      authorization_servers: [origin],
      scopes_supported: [OAUTH_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Gestionale Cambia-Menti',
    })
  }
  if (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/oauth-authorization-server/mcp') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed()
    return json(authorizationServerMetadata(origin))
  }
  if (path === '/oauth/register') {
    if (request.method !== 'POST') return methodNotAllowed()
    return register(request, env)
  }
  if (path === '/oauth/authorize') {
    if (request.method === 'GET') return authorizeGet(request, env, origin)
    if (request.method === 'POST') return authorizePost(request, env, origin)
    return methodNotAllowed()
  }
  if (path === '/oauth/token') {
    if (request.method !== 'POST') return methodNotAllowed()
    return token(request, env, origin)
  }
  if (path === '/oauth/revoke') {
    if (request.method !== 'POST') return methodNotAllowed()
    return revoke(request, env)
  }
  return null
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [OAUTH_SCOPE],
  }
}

// ---------------------------------------------------------------- registrazione

type ClientRow = {
  id: string
  secret_hash: string | null
  name: string
  redirect_uris: string
  token_endpoint_auth_method: string
}

async function register(request: Request, env: Env): Promise<Response> {
  const limitKey = `register:${clientIp(request)}`
  if (await tooManyAttempts(env.DB, limitKey)) {
    return oauthError('slow_down', 'Troppe registrazioni, riprova tra qualche minuto', 429)
  }
  await recordAttempt(env.DB, limitKey)
  const body = await readJson(request)
  if (!body) return oauthError('invalid_client_metadata', 'Corpo JSON non valido', 400)

  const redirectUris = body.redirect_uris
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > MAX_REDIRECT_URIS) {
    return oauthError('invalid_redirect_uri', 'redirect_uris obbligatorio (1-10 URL)', 400)
  }
  for (const uri of redirectUris) {
    if (typeof uri !== 'string' || uri.length > MAX_REDIRECT_URI_LENGTH || !isAllowedRedirectUri(uri)) {
      return oauthError('invalid_redirect_uri', `redirect_uri non ammesso: ${String(uri)}`, 400)
    }
  }
  const authMethod = typeof body.token_endpoint_auth_method === 'string' ? body.token_endpoint_auth_method : 'none'
  if (!['none', 'client_secret_post', 'client_secret_basic'].includes(authMethod)) {
    return oauthError('invalid_client_metadata', 'token_endpoint_auth_method non supportato', 400)
  }
  const grantTypes = Array.isArray(body.grant_types) ? body.grant_types : ['authorization_code']
  if (grantTypes.some((g) => g !== 'authorization_code' && g !== 'refresh_token')) {
    return oauthError('invalid_client_metadata', 'grant_types non supportato', 400)
  }
  const responseTypes = Array.isArray(body.response_types) ? body.response_types : ['code']
  if (responseTypes.some((r) => r !== 'code')) {
    return oauthError('invalid_client_metadata', 'response_types non supportato', 400)
  }
  const name = (typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim() : 'Client MCP').slice(0, 100)

  await pruneStale(env.DB)

  const id = `cmc_${randomHex(16)}`
  const secret = authMethod === 'none' ? null : `cms_${randomHex(32)}`
  const createdAt = new Date()
  await env.DB.prepare(
    `INSERT INTO oauth_clients (id, secret_hash, name, redirect_uris, token_endpoint_auth_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, secret ? await sha256Hex(secret) : null, name, JSON.stringify(redirectUris), authMethod, createdAt.toISOString())
    .run()

  const response: Record<string, unknown> = {
    client_id: id,
    client_id_issued_at: Math.floor(createdAt.getTime() / 1000),
    client_name: name,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: authMethod,
    scope: OAUTH_SCOPE,
  }
  if (secret) {
    response.client_secret = secret
    response.client_secret_expires_at = 0
  }
  return json(response, 201)
}

/** Pulizia a campione: client mai usati da più di 7 giorni e codici scaduti. */
async function pruneStale(db: D1Database): Promise<void> {
  if (Math.random() > 0.1) return
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await db.prepare('DELETE FROM oauth_clients WHERE last_used_at IS NULL AND created_at < ?').bind(cutoff).run()
  await db.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').bind(new Date().toISOString()).run()
}

export function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
    return false
  }
  if (parsed.hash) return false
  if (parsed.protocol === 'https:') return true
  return parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
}

/** Confronto esatto; per i redirect loopback (Claude Code, CLI) la porta è libera (RFC 8252 §7.3). */
export function redirectUriMatches(registered: string[], candidate: string): boolean {
  if (registered.includes(candidate)) return true
  let c: URL
  try {
    c = new URL(candidate)
  } catch {
    return false
  }
  if (c.protocol !== 'http:' || !isLoopbackHost(c.hostname)) return false
  return registered.some((r) => {
    try {
      const u = new URL(r)
      return u.protocol === 'http:' && u.hostname === c.hostname && u.pathname === c.pathname && u.search === c.search
    } catch {
      return false
    }
  })
}

async function getClient(db: D1Database, clientId: string | null): Promise<ClientRow | null> {
  if (!clientId) return null
  return db
    .prepare('SELECT id, secret_hash, name, redirect_uris, token_endpoint_auth_method FROM oauth_clients WHERE id = ?')
    .bind(clientId)
    .first<ClientRow>()
}

// ---------------------------------------------------------------- authorize

const AUTHORIZE_PARAMS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'] as const

type AuthorizeRequest = {
  client: ClientRow
  redirectUri: string
  codeChallenge: string
  state: string | null
  params: Record<string, string>
}

type ValidationResult =
  | { ok: true; value: AuthorizeRequest }
  | { ok: false; page: string }
  | { ok: false; redirect: string }

function resourceAllowed(resource: string | null, origin: string): boolean {
  if (!resource) return true
  const r = resource.replace(/\/+$/, '')
  return r === resourceUrl(origin) || r === origin
}

async function validateAuthorize(env: Env, origin: string, get: (k: string) => string | null): Promise<ValidationResult> {
  const client = await getClient(env.DB, get('client_id'))
  if (!client) return { ok: false, page: 'Client sconosciuto. Riprova ad aggiungere il connettore.' }
  const redirectUri = get('redirect_uri')
  const registered = JSON.parse(client.redirect_uris) as string[]
  if (!redirectUri || !redirectUriMatches(registered, redirectUri)) {
    return { ok: false, page: "L'indirizzo di ritorno non corrisponde a quello registrato dal client." }
  }
  const state = get('state')
  const fail = (error: string, description: string) => ({
    ok: false as const,
    redirect: withParams(redirectUri, { error, error_description: description, state, iss: origin }),
  })
  if (get('response_type') !== 'code') return fail('unsupported_response_type', 'Serve response_type=code')
  const codeChallenge = get('code_challenge')
  if (!codeChallenge || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) return fail('invalid_request', 'PKCE code_challenge mancante o non valido')
  if ((get('code_challenge_method') ?? 'plain') !== 'S256') return fail('invalid_request', 'Solo code_challenge_method=S256')
  if (!resourceAllowed(get('resource'), origin)) return fail('invalid_target', 'Risorsa non servita da questo server')
  const requested = (get('scope') ?? '').split(/\s+/).filter(Boolean)
  if (requested.some((s) => s !== OAUTH_SCOPE && s !== 'offline_access')) return fail('invalid_scope', `Scope supportato: ${OAUTH_SCOPE}`)

  const params: Record<string, string> = {}
  for (const key of AUTHORIZE_PARAMS) {
    const v = get(key)
    if (v !== null) params[key] = v
  }
  return { ok: true, value: { client, redirectUri, codeChallenge, state, params } }
}

async function authorizeGet(request: Request, env: Env, origin: string): Promise<Response> {
  const url = new URL(request.url)
  const result = await validateAuthorize(env, origin, (k) => url.searchParams.get(k))
  if (!result.ok) return 'page' in result ? html(errorPage(result.page), 400) : redirect(result.redirect)
  const csrf = randomHex(24)
  const page = consentPage({
    clientName: result.value.client.name,
    redirectHost: new URL(result.value.redirectUri).host,
    params: result.value.params,
    csrf,
  })
  return html(page, 200, { 'Set-Cookie': csrfCookie(request, csrf) })
}

async function authorizePost(request: Request, env: Env, origin: string): Promise<Response> {
  const form = await request.formData().catch(() => null)
  if (!form) return html(errorPage('Richiesta non valida.'), 400)
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v : null
  }
  const result = await validateAuthorize(env, origin, get)
  if (!result.ok) return 'page' in result ? html(errorPage(result.page), 400) : redirect(result.redirect)
  const req = result.value

  const csrf = get('csrf')
  const cookieCsrf = parseCookie(request.headers.get('cookie'), CSRF_COOKIE)
  if (!csrf || !cookieCsrf || !safeEqual(csrf, cookieCsrf)) {
    return html(errorPage('Sessione di autorizzazione scaduta. Torna a Claude e riprova.'), 400)
  }
  if (get('decision') !== 'allow') {
    return redirect(withParams(req.redirectUri, { error: 'access_denied', error_description: 'Autorizzazione negata', state: req.state, iss: origin }), clearCsrf(request))
  }

  const email = (get('email') ?? '').trim().toLowerCase()
  const password = get('password') ?? ''
  const limitKey = `login:${clientIp(request)}:${email}`
  const rerender = (error: string, status: number) => {
    const fresh = randomHex(24)
    return html(
      consentPage({ clientName: req.client.name, redirectHost: new URL(req.redirectUri).host, params: req.params, csrf: fresh, error }),
      status,
      { 'Set-Cookie': csrfCookie(request, fresh) },
    )
  }
  if (await tooManyAttempts(env.DB, limitKey)) return rerender('Troppi tentativi. Riprova tra qualche minuto.', 429)

  let session: SupabaseSession
  try {
    session = await passwordLogin(env, email, password)
  } catch (error) {
    await recordAttempt(env.DB, limitKey)
    if (error instanceof AuthError) return rerender('Email o password non corretti.', 401)
    return rerender('Accesso non disponibile, riprova tra poco.', 502)
  }
  const role = await fetchRole(env, session)
  if (!isStaffRole(role)) {
    await logout(env, session)
    return rerender('Questo utente non ha accesso al gestionale come staff.', 403)
  }

  const code = `cmac_${randomHex(32)}`
  const now = Date.now()
  await env.DB.prepare(
    `INSERT INTO oauth_codes (code_hash, client_id, user_id, email, redirect_uri, code_challenge, scope, sb_session_enc, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      await sha256Hex(code),
      req.client.id,
      session.userId,
      session.email || email,
      req.redirectUri,
      req.codeChallenge,
      OAUTH_SCOPE,
      await encryptSession(env, session),
      new Date(now + CODE_TTL_MS).toISOString(),
      new Date(now).toISOString(),
    )
    .run()

  return redirect(withParams(req.redirectUri, { code, state: req.state, iss: origin }), clearCsrf(request))
}

// ---------------------------------------------------------------- token

type TokenParams = (k: string) => string | null

async function readTokenParams(request: Request): Promise<TokenParams | null> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const body = await readJson(request)
    if (!body) return null
    return (k) => (typeof body[k] === 'string' ? (body[k] as string) : null)
  }
  const text = await request.text().catch(() => null)
  if (text === null) return null
  const params = new URLSearchParams(text)
  return (k) => params.get(k)
}

async function authenticateClient(request: Request, env: Env, get: TokenParams): Promise<ClientRow | Response> {
  let clientId = get('client_id')
  let clientSecret = get('client_secret')
  const basic = request.headers.get('authorization')
  if (basic?.toLowerCase().startsWith('basic ')) {
    try {
      const decoded = atob(basic.slice(6).trim())
      const sep = decoded.indexOf(':')
      clientId = decodeURIComponent(decoded.slice(0, sep))
      clientSecret = decodeURIComponent(decoded.slice(sep + 1))
    } catch {
      return oauthError('invalid_client', 'Header Basic non valido', 401)
    }
  }
  const client = await getClient(env.DB, clientId)
  if (!client) return oauthError('invalid_client', 'Client sconosciuto', 401)
  if (client.secret_hash) {
    if (!clientSecret || !safeEqual(await sha256Hex(clientSecret), client.secret_hash)) {
      return oauthError('invalid_client', 'Credenziali client non valide', 401)
    }
  }
  return client
}

async function token(request: Request, env: Env, origin: string): Promise<Response> {
  const get = await readTokenParams(request)
  if (!get) return oauthError('invalid_request', 'Corpo non valido', 400)
  const client = await authenticateClient(request, env, get)
  if (client instanceof Response) return client
  const grantType = get('grant_type')
  if (grantType === 'authorization_code') return exchangeCode(env, client, get, origin)
  if (grantType === 'refresh_token') return refresh(env, client, get)
  return oauthError('unsupported_grant_type', 'grant_type non supportato', 400)
}

type CodeRow = {
  client_id: string
  user_id: string
  email: string
  redirect_uri: string
  code_challenge: string
  scope: string
  sb_session_enc: string
  expires_at: string
  used_at: string | null
  grant_id: string | null
}

async function exchangeCode(env: Env, client: ClientRow, get: TokenParams, origin: string): Promise<Response> {
  const code = get('code')
  const verifier = get('code_verifier')
  const redirectUri = get('redirect_uri')
  if (!code || !verifier) return oauthError('invalid_request', 'code e code_verifier obbligatori', 400)
  if (!resourceAllowed(get('resource'), origin)) return oauthError('invalid_target', 'Risorsa non servita da questo server', 400)

  const codeHash = await sha256Hex(code)
  const row = await env.DB.prepare(
    'SELECT client_id, user_id, email, redirect_uri, code_challenge, scope, sb_session_enc, expires_at, used_at, grant_id FROM oauth_codes WHERE code_hash = ?',
  )
    .bind(codeHash)
    .first<CodeRow>()
  // Tutti i controlli prima di consumare il codice: chi intercetta un codice non può "bruciarlo".
  if (!row || row.client_id !== client.id) return oauthError('invalid_grant', 'Codice non valido', 400)
  if (row.expires_at < new Date().toISOString()) return oauthError('invalid_grant', 'Codice scaduto', 400)
  if (redirectUri !== null && redirectUri !== row.redirect_uri) return oauthError('invalid_grant', 'redirect_uri diverso', 400)
  if (!(await pkceMatches(verifier, row.code_challenge))) return oauthError('invalid_grant', 'PKCE non valido', 400)
  const now = new Date().toISOString()
  if (row.used_at) {
    // OAuth 2.1 §4.1.2: codice riusato -> si revoca la concessione già emessa con quel codice.
    if (row.grant_id) await revokeGrant(env, row.grant_id, now)
    return oauthError('invalid_grant', 'Codice già usato', 400)
  }

  const grantId = `cmg_${randomHex(12)}`
  const consumed = await env.DB.prepare('UPDATE oauth_codes SET used_at = ?, grant_id = ?, sb_session_enc = ? WHERE code_hash = ? AND used_at IS NULL')
    .bind(now, grantId, '', codeHash)
    .run()
  if ((consumed.meta?.changes ?? 0) !== 1) return oauthError('invalid_grant', 'Codice già usato', 400)

  const access = `cma_${randomHex(32)}`
  const refreshToken = `cmr_${randomHex(32)}`
  await env.DB.prepare(
    `INSERT INTO oauth_grants (id, client_id, user_id, email, access_hash, access_expires_at, refresh_hash, sb_session_enc, scope, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      grantId,
      client.id,
      row.user_id,
      row.email,
      await sha256Hex(access),
      new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
      await sha256Hex(refreshToken),
      row.sb_session_enc,
      row.scope,
      now,
      now,
    )
    .run()
  await env.DB.prepare('UPDATE oauth_clients SET last_used_at = ? WHERE id = ?').bind(now, client.id).run()
  return tokenResponse(access, refreshToken, row.scope)
}

type GrantRow = {
  id: string
  client_id: string
  user_id: string
  sb_session_enc: string
  scope: string
  revoked_at: string | null
  updated_at: string
}

async function refresh(env: Env, client: ClientRow, get: TokenParams): Promise<Response> {
  const presented = get('refresh_token')
  if (!presented) return oauthError('invalid_request', 'refresh_token obbligatorio', 400)
  const hash = await sha256Hex(presented)
  const now = new Date().toISOString()
  const columns = 'id, client_id, user_id, sb_session_enc, scope, revoked_at, updated_at'

  let grant = await env.DB.prepare(`SELECT ${columns} FROM oauth_grants WHERE refresh_hash = ?`).bind(hash).first<GrantRow>()
  let matchColumn: 'refresh_hash' | 'previous_refresh_hash' = 'refresh_hash'
  if (!grant) {
    const previous = await env.DB.prepare(`SELECT ${columns} FROM oauth_grants WHERE previous_refresh_hash = ?`).bind(hash).first<GrantRow>()
    if (!previous) return oauthError('invalid_grant', 'Refresh token non valido', 400)
    if (Date.now() - Date.parse(previous.updated_at) > REFRESH_GRACE_MS) {
      // Riuso di un refresh token già ruotato da tempo: possibile furto, si revoca la concessione.
      if (!previous.revoked_at) await revokeGrant(env, previous.id, now)
      return oauthError('invalid_grant', 'Refresh token non valido', 400)
    }
    grant = previous
    matchColumn = 'previous_refresh_hash'
  }
  if (grant.client_id !== client.id) return oauthError('invalid_grant', 'Refresh token di un altro client', 400)
  if (grant.revoked_at) return oauthError('invalid_grant', 'Accesso revocato', 400)

  // Si ricontrolla l'utente: se non è più staff (o la sessione Supabase è chiusa) il connettore smette di funzionare.
  let session: SupabaseSession
  try {
    session = await freshSupabaseSession(env, grant, true)
  } catch (error) {
    if (error instanceof AuthError) {
      await env.DB.prepare('UPDATE oauth_grants SET revoked_at = ? WHERE id = ?').bind(now, grant.id).run()
      return oauthError('invalid_grant', 'Sessione del gestionale scaduta: ricollega il connettore', 400)
    }
    throw error
  }
  if (!isStaffRole(await fetchRole(env, session))) {
    await env.DB.prepare('UPDATE oauth_grants SET revoked_at = ? WHERE id = ?').bind(now, grant.id).run()
    return oauthError('invalid_grant', 'Utente non più abilitato al gestionale', 400)
  }

  const access = `cma_${randomHex(32)}`
  const nextRefresh = `cmr_${randomHex(32)}`
  const rotated = await env.DB.prepare(
    `UPDATE oauth_grants SET access_hash = ?, access_expires_at = ?, refresh_hash = ?, previous_refresh_hash = ?, updated_at = ?
     WHERE id = ? AND ${matchColumn} = ? AND revoked_at IS NULL`,
  )
    .bind(await sha256Hex(access), new Date(Date.now() + ACCESS_TTL_MS).toISOString(), await sha256Hex(nextRefresh), hash, now, grant.id, hash)
    .run()
  if ((rotated.meta?.changes ?? 0) !== 1) return oauthError('invalid_grant', 'Refresh token già usato', 400)
  await env.DB.prepare('UPDATE oauth_clients SET last_used_at = ? WHERE id = ?').bind(now, client.id).run()
  return tokenResponse(access, nextRefresh, grant.scope)
}

async function revoke(request: Request, env: Env): Promise<Response> {
  const get = await readTokenParams(request)
  if (!get) return oauthError('invalid_request', 'Corpo non valido', 400)
  const client = await authenticateClient(request, env, get)
  if (client instanceof Response) return client
  const value = get('token')
  if (value) {
    const hash = await sha256Hex(value)
    const row = await env.DB.prepare('SELECT id FROM oauth_grants WHERE (refresh_hash = ? OR access_hash = ?) AND client_id = ?')
      .bind(hash, hash, client.id)
      .first<{ id: string }>()
    if (row) await revokeGrant(env, row.id, new Date().toISOString())
  }
  // RFC 7009: 200 anche per token sconosciuti.
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store', ...corsHeaders() } })
}

/** Revoca la concessione e chiude la sessione Supabase collegata. */
async function revokeGrant(env: Env, grantId: string, now: string): Promise<void> {
  const row = await env.DB.prepare('SELECT sb_session_enc FROM oauth_grants WHERE id = ? AND revoked_at IS NULL')
    .bind(grantId)
    .first<{ sb_session_enc: string }>()
  await env.DB.prepare('UPDATE oauth_grants SET revoked_at = ? WHERE id = ?').bind(now, grantId).run()
  if (row?.sb_session_enc) {
    const session = await decryptSession(env, row.sb_session_enc).catch(() => null)
    if (session) await logout(env, session)
  }
}

function tokenResponse(accessToken: string, refreshToken: string, scope: string): Response {
  return json({ access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TTL_MS / 1000, refresh_token: refreshToken, scope })
}

// ---------------------------------------------------------------- sessione Supabase cifrata

export async function encryptSession(env: Env, session: SupabaseSession): Promise<string> {
  return encryptText(env.CAMBIAMENTI_MCP_TOKEN_KEY, JSON.stringify(session))
}

export async function decryptSession(env: Env, payload: string): Promise<SupabaseSession> {
  return JSON.parse(await decryptText(env.CAMBIAMENTI_MCP_TOKEN_KEY, payload)) as SupabaseSession
}

const SUPABASE_MARGIN_MS = 2 * 60 * 1000

/**
 * Sessione Supabase valida per la concessione: rinnova l'access token se sta per scadere
 * e salva la nuova sessione (Supabase ruota anche il suo refresh token).
 */
export async function freshSupabaseSession(env: Env, grant: { id: string; sb_session_enc: string }, force = false): Promise<SupabaseSession> {
  const current = await decryptSession(env, grant.sb_session_enc)
  if (!force && current.expiresAt - SUPABASE_MARGIN_MS > Date.now()) return current
  const next = await refreshSession(env, current.refreshToken)
  await env.DB.prepare('UPDATE oauth_grants SET sb_session_enc = ? WHERE id = ? AND sb_session_enc = ?')
    .bind(await encryptSession(env, next), grant.id, grant.sb_session_enc)
    .run()
  return next
}

// ---------------------------------------------------------------- utilità

function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

function csrfCookie(request: Request, value: string): string {
  return `${CSRF_COOKIE}=${value}; Path=/oauth; HttpOnly; SameSite=Strict; Max-Age=1800${isHttps(request) ? '; Secure' : ''}`
}

function clearCsrf(request: Request): Record<string, string> {
  return { 'Set-Cookie': `${CSRF_COOKIE}=; Path=/oauth; HttpOnly; SameSite=Strict; Max-Age=0${isHttps(request) ? '; Secure' : ''}` }
}

function oauthError(error: string, description: string, status: number): Response {
  const extra: Record<string, string> = status === 401 ? { 'WWW-Authenticate': 'Basic realm="Cambia-Menti OAuth"' } : {}
  return json({ error, error_description: description }, status, extra)
}
