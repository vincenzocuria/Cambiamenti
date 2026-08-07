import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildAuthEmailCatalog,
  notificationEnableKeys,
} from './lib/authEmailCatalog.mjs'
import { getSupabaseAccessToken } from './lib/supabaseAccessToken.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const templatesDir = path.join(root, 'supabase', 'templates')
const projectRef = process.env.SUPABASE_PROJECT_REF || 'nmmjivrsuezhptwsfqdv'

const token = getSupabaseAccessToken()
if (!token) {
  console.error('Token Supabase non trovato. Esegui: npx supabase login')
  process.exit(1)
}

const catalog = buildAuthEmailCatalog()
const body = {}

for (const [key, meta] of Object.entries(catalog)) {
  const filePath = path.join(templatesDir, meta.file)
  if (!fs.existsSync(filePath)) {
    console.error(`Template mancante: ${filePath}. Esegui: node scripts/write-auth-email-templates.mjs`)
    process.exit(1)
  }
  body[`mailer_subjects_${key}`] = meta.subject
  body[`mailer_templates_${key}_content`] = fs.readFileSync(filePath, 'utf8')
}

for (const key of notificationEnableKeys) {
  body[`mailer_notifications_${key}_enabled`] = true
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
  const text = await res.text()
  if (res.status === 400 && text.includes('not available for free tier')) {
    console.error('FREE_TIER: serve SMTP custom prima dei template. Esegui: node scripts/deploy-auth-smtp.mjs')
    process.exit(2)
  }
  console.error(`Templates PATCH failed (${res.status}): ${text}`)
  process.exit(1)
}

console.log(`OK ${Object.keys(catalog).length} template email auth IT`)
