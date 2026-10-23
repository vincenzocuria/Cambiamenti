import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
import { getSuperAdminEmails } from '../lib/securityConfig.js'

const email = getSuperAdminEmails()[0] || ''

if (!email) {
  console.error('ERRORE: VITE_SUPERADMIN_EMAILS non configurato')
  process.exit(1)
}
const password = process.env.SUPERADMIN_PASSWORD
const fullName = process.env.SUPERADMIN_NAME || 'Vincenzo Curia'

if (!url || !key) {
  console.error('Mancano VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}
if (!password || password.length < 8) {
  console.error('Imposta SUPERADMIN_PASSWORD (min 8 caratteri)')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: fullName } },
})

if (error) {
  console.error('Registrazione fallita:', error.message)
  process.exit(1)
}

console.log(JSON.stringify({
  userId: data.user?.id ?? null,
  email,
  identities: data.user?.identities?.length ?? 0,
}, null, 2))
