// Client Supabase con il JWT dell'utente (niente service_role: valgono le regole RLS).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../env'

export function userClient(env: Env, jwt: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

/** Errore leggibile da un errore PostgREST/Storage. */
export function dbError(error: { message?: string; code?: string } | null, what: string): Error {
  return new Error(`${what}: ${error?.message ?? 'errore sconosciuto'}${error?.code ? ` (${error.code})` : ''}`)
}
