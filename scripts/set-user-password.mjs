import { getSupabaseAccessToken } from './lib/supabaseAccessToken.mjs'

const projectRef = process.env.SUPABASE_PROJECT_REF || 'nmmjivrsuezhptwsfqdv'
const email = (process.env.RESET_EMAIL || '').trim().toLowerCase()
const password = process.env.RESET_PASSWORD || ''

if (!email || !email.includes('@')) {
  console.error('Imposta RESET_EMAIL')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Imposta RESET_PASSWORD (min 8 caratteri)')
  process.exit(1)
}

const token = getSupabaseAccessToken()
if (!token) {
  console.error('Token Supabase non trovato')
  process.exit(1)
}

const keysRes = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`,
  { headers: { Authorization: `Bearer ${token}` } },
)
if (!keysRes.ok) {
  console.error('Impossibile leggere le API key')
  process.exit(1)
}
const keys = await keysRes.json()
const service = (Array.isArray(keys) ? keys : [])
  .find((k) => k.name === 'service_role' || k.api_key?.startsWith('eyJ') && k.name?.includes('service'))
const serviceKey = service?.api_key || service?.key
if (!serviceKey) {
  console.error('service_role non trovata')
  process.exit(1)
}

const url = `https://${projectRef}.supabase.co`
const headers = {
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  'Content-Type': 'application/json',
}

const listRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers })
if (!listRes.ok) {
  console.error('Impossibile elencare gli utenti auth')
  process.exit(1)
}
const listed = await listRes.json()
const users = listed.users || listed
const user = (Array.isArray(users) ? users : []).find(
  (u) => String(u.email || '').toLowerCase() === email,
)
if (!user?.id) {
  console.error('Utente non trovato')
  process.exit(1)
}

const upd = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ password }),
})
if (!upd.ok) {
  console.error('Aggiornamento password fallito')
  process.exit(1)
}

console.log('Password aggiornata')
