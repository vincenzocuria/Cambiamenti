import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { JSDOM } from 'jsdom'
import { loadEnvFile } from '../lib/loadEnvFile.mjs'
import { getSupabaseAccessToken } from '../lib/supabaseAccessToken.mjs'
import {
  CAMBIAMENTI_SUPABASE_PROJECT_REF,
  CAMBIAMENTI_SUPABASE_URL,
} from '../lib/cambiamentiSupabaseProject.mjs'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Cartella dei file prodotti dallo script (esplorazione, download): resta sul PC, fuori da git. */
export const dataDir = path.join(repoRoot, 'scripts', 'aruba-sync', '.data')

/** Profilo del browser con la sessione Aruba salvata (cookie, OTP ricordato). */
export const profileDir = path.join(os.homedir(), '.cambiamenti-aruba', 'profilo-edge')

// Il parser FatturaPA dell'app usa DOMParser come nel browser
const dom = new JSDOM('')
;(globalThis as { DOMParser?: unknown }).DOMParser = dom.window.DOMParser

loadEnvFile(path.join(repoRoot, 'scripts', 'cambiamenti-secrets.env'))
// File centrale delle credenziali: solo le voci Aruba di Cambia-Menti
loadEnvFile(path.join(repoRoot, '..', 'Global Res', '.env'), [
  'CAMBIAMENTI_ARUBA_FE_USERNAME',
  'CAMBIAMENTI_ARUBA_FE_PASSWORD',
])

export function arubaCredentials(): { username: string; password: string } | null {
  const username = process.env.CAMBIAMENTI_ARUBA_FE_USERNAME?.trim()
  const password = process.env.CAMBIAMENTI_ARUBA_FE_PASSWORD?.trim()
  return username && password ? { username, password } : null
}

/** Client Supabase con la chiave service_role, letta al momento dalla Management API. */
export async function supabaseAdmin(): Promise<SupabaseClient> {
  const token = getSupabaseAccessToken()
  if (!token) throw new Error('Token Supabase non trovato: esegui prima «npx supabase login»')
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${CAMBIAMENTI_SUPABASE_PROJECT_REF}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Chiavi Supabase non lette (${res.status})`)
  const keys = (await res.json()) as { name?: string; api_key?: string }[]
  const key = keys.find((k) => k.name === 'service_role')?.api_key
  if (!key) throw new Error('Chiave service_role non trovata')
  return createClient(CAMBIAMENTI_SUPABASE_URL, key, { auth: { persistSession: false } })
}
