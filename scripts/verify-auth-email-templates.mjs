import { getSupabaseAccessToken } from './lib/supabaseAccessToken.mjs'

const projectRef = process.env.SUPABASE_PROJECT_REF || 'nmmjivrsuezhptwsfqdv'
const token = getSupabaseAccessToken()
if (!token) {
  console.error('no token')
  process.exit(1)
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  { headers: { Authorization: `Bearer ${token}` } },
)
if (!res.ok) {
  console.error(`GET failed ${res.status}`)
  process.exit(1)
}

const cfg = await res.json()
const subjectKeys = Object.keys(cfg)
  .filter((k) => k.startsWith('mailer_subjects_'))
  .sort()

for (const key of subjectKeys) {
  console.log(`${key}: ${cfg[key]}`)
}

console.log(`smtp_host: ${cfg.smtp_host}`)
console.log(`smtp_sender_name: ${cfg.smtp_sender_name}`)
console.log(`smtp_admin_email: ${cfg.smtp_admin_email}`)

const html = cfg.mailer_templates_confirmation_content || ''
console.log('confirmation_has_logo:', html.includes('logo-cambia-menti.png'))
console.log('confirmation_has_brand:', html.includes('Cambia-Menti'))
console.log('confirmation_has_vat:', html.includes('03936190788'))
console.log('confirmation_it:', /Conferma la tua email/.test(html))
