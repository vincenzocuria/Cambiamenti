// Accesso a Supabase Auth con la chiave publishable: nessuna chiave service_role nel Worker.
// Ogni chiamata ai dati usa il JWT dell'utente, quindi valgono le stesse regole RLS del sito.

import type { Env } from '../env'

export const STAFF_ROLES = ['superadmin', 'admin', 'staff'] as const

/** Sessione Supabase dell'utente (salvata solo cifrata). */
export interface SupabaseSession {
  accessToken: string
  refreshToken: string
  /** Scadenza dell'access token, epoch ms. */
  expiresAt: number
  userId: string
  email: string
}

export class AuthError extends Error {}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  user?: { id?: string; email?: string }
}

async function tokenRequest(env: Env, grantType: 'password' | 'refresh_token', body: Record<string, string>): Promise<SupabaseSession> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new AuthError(res.status === 400 || res.status === 401 ? 'Credenziali non valide o sessione scaduta' : `Supabase Auth ${res.status}`)
  }
  const data = (await res.json()) as TokenResponse
  if (!data.access_token || !data.refresh_token || !data.user?.id) throw new AuthError('Risposta di Supabase Auth incompleta')
  const expiresAt = data.expires_at ? data.expires_at * 1000 : Date.now() + (data.expires_in ?? 3600) * 1000
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    userId: data.user.id,
    email: data.user.email ?? '',
  }
}

export function passwordLogin(env: Env, email: string, password: string): Promise<SupabaseSession> {
  return tokenRequest(env, 'password', { email, password })
}

export function refreshSession(env: Env, refreshToken: string): Promise<SupabaseSession> {
  return tokenRequest(env, 'refresh_token', { refresh_token: refreshToken })
}

/** Ruolo dell'utente letto con il suo JWT (RLS: ognuno vede il proprio profilo). */
export async function fetchRole(env: Env, session: SupabaseSession): Promise<string | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(session.userId)}`
  const res = await fetch(url, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.accessToken}` },
  })
  if (!res.ok) return null
  const rows = (await res.json()) as { role?: string }[]
  return rows[0]?.role ?? null
}

export function isStaffRole(role: string | null): boolean {
  return role !== null && (STAFF_ROLES as readonly string[]).includes(role)
}

/** Chiude la sessione Supabase (revoca del connettore). Errori ignorati. */
export async function logout(env: Env, session: SupabaseSession): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.accessToken}` },
  }).catch(() => undefined)
}
