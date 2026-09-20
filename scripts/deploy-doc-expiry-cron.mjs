import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSupabaseAccessToken } from './lib/supabaseAccessToken.mjs'
import { loadEnvFile } from './lib/loadEnvFile.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const secretsPath = path.join(root, 'scripts', 'cambiamenti-secrets.env')
const projectRef = process.env.SUPABASE_PROJECT_REF || 'nmmjivrsuezhptwsfqdv'

loadEnvFile(secretsPath)
if (!process.env.SMTP_PASS) {
  loadEnvFile(path.join(root, '..', 'lidia', 'scripts', 'auth-smtp.env'))
}
if (!process.env.SMTP_PASS || process.env.SMTP_PASS === 're_INCOLLA_API_KEY') {
  loadEnvFile(path.join(root, '..', 'lidia', 'scripts', 'lidia-secrets.env'))
}

function ensureCronSecret() {
  let secret = process.env.CRON_SECRET?.trim() || process.env.NOTIFICATION_CRON_SECRET?.trim()
  if (secret) return secret

  secret = crypto.randomBytes(24).toString('hex')
  const line = `CRON_SECRET=${secret}\n`
  fs.appendFileSync(secretsPath, line, 'utf8')
  process.env.CRON_SECRET = secret
  console.log(`Generato CRON_SECRET in scripts/cambiamenti-secrets.env`)
  return secret
}

async function syncSupabaseSecrets(cronSecret) {
  const token = getSupabaseAccessToken()
  if (!token) {
    console.warn('SKIP sync Supabase: token assente')
    return
  }

  process.env.SUPABASE_ACCESS_TOKEN = token
  const resendKey = process.env.SMTP_PASS?.trim()
  if (!resendKey || resendKey === 're_INCOLLA_API_KEY') {
    console.warn('SKIP sync Supabase: SMTP_PASS assente')
    return
  }

  const fromEmail = process.env.SMTP_ADMIN_EMAIL?.trim() || 'no-reply@vcuria.app'
  const adminEmail = fromEmail === 'onboarding@resend.dev' ? 'no-reply@vcuria.app' : fromEmail
  const pairs = {
    RESEND_API_KEY: resendKey,
    NOTIFICATION_FROM_EMAIL: adminEmail,
    NOTIFICATION_FROM_NAME: process.env.SMTP_SENDER_NAME?.trim() || 'Cambia-Menti Formazione',
    APP_ORIGIN: 'https://cambiamenti.vcuria.app',
    CRON_SECRET: cronSecret,
  }

  const envFile = path.join(process.env.TEMP || os.tmpdir(), `cm-fn-secrets-${Date.now()}.env`)
  fs.writeFileSync(
    envFile,
    Object.entries(pairs)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    'utf8',
  )
  try {
    execFileSync(
      'npx',
      ['supabase', 'secrets', 'set', '--env-file', envFile, '--project-ref', projectRef],
      { cwd: root, stdio: 'inherit', env: process.env, shell: true },
    )
  } finally {
    try {
      fs.unlinkSync(envFile)
    } catch {
      /* ignore */
    }
  }
}

function deployCronWorker(cronSecret) {
  execFileSync(
    'npx',
    ['wrangler', 'deploy', '-c', 'wrangler.cron.jsonc'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, CRON_SECRET: cronSecret },
      shell: true,
    },
  )

  execFileSync(
    'npx',
    ['wrangler', 'secret', 'put', 'CRON_SECRET', '-c', 'wrangler.cron.jsonc'],
    {
      cwd: root,
      stdio: ['pipe', 'inherit', 'inherit'],
      input: cronSecret,
      shell: true,
    },
  )
}

async function triggerOnce(cronSecret) {
  const url = `https://${projectRef}.supabase.co/functions/v1/check-doc-expiry`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': cronSecret,
    },
    body: '{}',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Test check-doc-expiry ${res.status}: ${text}`)
  console.log('Test check-doc-expiry:', text)
}

const cronSecret = ensureCronSecret()
await syncSupabaseSecrets(cronSecret)
deployCronWorker(cronSecret)
await triggerOnce(cronSecret)
console.log('OK cron scadenze documenti (ogni giorno 05:00 UTC)')
