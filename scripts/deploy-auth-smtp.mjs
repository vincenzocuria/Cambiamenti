import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSupabaseAccessToken } from './lib/supabaseAccessToken.mjs'
import { loadEnvFile } from './lib/loadEnvFile.mjs'
import { emailBrand } from './lib/emailBrand.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRef = process.env.SUPABASE_PROJECT_REF || 'nmmjivrsuezhptwsfqdv'

loadEnvFile(path.join(root, 'scripts', 'cambiamenti-secrets.env'))
const localSenderName = process.env.SMTP_SENDER_NAME?.trim()
// Fallback opzionale: stesso Resend già usato su vcuria.app (Lidia)
if (!process.env.SMTP_PASS) {
  loadEnvFile(path.join(root, '..', 'lidia', 'scripts', 'auth-smtp.env'))
}
if (!process.env.SMTP_PASS || process.env.SMTP_PASS === 're_INCOLLA_API_KEY') {
  loadEnvFile(path.join(root, '..', 'lidia', 'scripts', 'lidia-secrets.env'))
}

const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_ADMIN_EMAIL']
for (const key of required) {
  if (!process.env[key]?.trim()) {
    console.error(`Manca ${key}. Crea scripts/cambiamenti-secrets.env (vedi .example).`)
    process.exit(1)
  }
}

const token = getSupabaseAccessToken()
if (!token) {
  console.error('Token Supabase non trovato. Esegui: npx supabase login')
  process.exit(1)
}

const adminEmailRaw = process.env.SMTP_ADMIN_EMAIL.trim()
const adminEmail =
  adminEmailRaw === 'onboarding@resend.dev'
    ? 'no-reply@vcuria.app'
    : adminEmailRaw

const body = {
  external_email_enabled: true,
  smtp_host: process.env.SMTP_HOST.trim(),
  smtp_port: process.env.SMTP_PORT.trim(),
  smtp_user: process.env.SMTP_USER.trim(),
  smtp_pass: process.env.SMTP_PASS.trim(),
  smtp_admin_email: adminEmail,
  // Non ereditare SMTP_SENDER_NAME da altri progetti (es. Lidia)
  smtp_sender_name: localSenderName || emailBrand.name,
  rate_limit_email_sent: Number(process.env.RATE_LIMIT_EMAIL_SENT || 30),
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  },
)

if (!res.ok) {
  console.error(`SMTP PATCH failed (${res.status}): ${await res.text()}`)
  process.exit(1)
}

console.log(
  `OK SMTP ${body.smtp_host} mittente="${body.smtp_sender_name}" <${body.smtp_admin_email}>`,
)
