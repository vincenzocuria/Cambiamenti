// Autenticazione delle richieste a /mcp: token Bearer emesso dal nostro OAuth.

import type { Env } from '../env'
import { sha256Hex } from '../lib/crypto'
import { freshSupabaseSession } from '../oauth/oauth'
import { AuthError } from './supabase'

export interface McpAuth {
  grantId: string
  userId: string
  email: string
  /** JWT Supabase dell'utente: ogni query passa dalle regole RLS del gestionale. */
  supabaseJwt: string
}

export class UnauthorizedError extends Error {}

type GrantRow = {
  id: string
  user_id: string
  email: string
  sb_session_enc: string
  access_expires_at: string
  revoked_at: string | null
}

export async function authenticateBearer(env: Env, header: string | null): Promise<McpAuth> {
  if (!header?.toLowerCase().startsWith('bearer ')) throw new UnauthorizedError('Token mancante')
  const token = header.slice(7).trim()
  if (!token.startsWith('cma_')) throw new UnauthorizedError('Token non valido')
  const grant = await env.DB.prepare(
    'SELECT id, user_id, email, sb_session_enc, access_expires_at, revoked_at FROM oauth_grants WHERE access_hash = ?',
  )
    .bind(await sha256Hex(token))
    .first<GrantRow>()
  if (!grant || grant.revoked_at) throw new UnauthorizedError('Token non valido')
  if (grant.access_expires_at < new Date().toISOString()) throw new UnauthorizedError('Token scaduto')

  try {
    const session = await freshSupabaseSession(env, grant)
    if (Math.random() < 0.2) {
      await env.DB.prepare('UPDATE oauth_grants SET last_used_at = ? WHERE id = ?').bind(new Date().toISOString(), grant.id).run()
    }
    return { grantId: grant.id, userId: grant.user_id, email: grant.email, supabaseJwt: session.accessToken }
  } catch (error) {
    if (error instanceof AuthError) throw new UnauthorizedError('Sessione del gestionale scaduta')
    throw error
  }
}
