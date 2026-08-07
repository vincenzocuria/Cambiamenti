import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSupabaseAccessToken } from './lib/supabaseAccessToken.mjs'
import { loadEnvFile } from './lib/loadEnvFile.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(path.join(root, 'scripts', 'cambiamenti-secrets.env'))
if (!process.env.SMTP_PASS) {
  loadEnvFile(path.join(root, '..', 'lidia', 'scripts', 'auth-smtp.env'))
}
if (!process.env.SMTP_PASS || process.env.SMTP_PASS === 're_INCOLLA_API_KEY') {
  loadEnvFile(path.join(root, '..', 'lidia', 'scripts', 'lidia-secrets.env'))
}

const projectRef = process.env.SUPABASE_PROJECT_REF || 'nmmjivrsuezhptwsfqdv'
const token = getSupabaseAccessToken()
if (!token) {
  console.error('Token Supabase non trovato')
  process.exit(1)
}

process.env.SUPABASE_ACCESS_TOKEN = token

const functions = [
  { name: 'invite-user', verifyJwt: true },
  { name: 'send-notification-email', verifyJwt: false },
  { name: 'check-doc-expiry', verifyJwt: false },
]

for (const fn of functions) {
  const args = [
    'supabase',
    'functions',
    'deploy',
    fn.name,
    '--project-ref',
    projectRef,
    '--use-api',
  ]
  if (!fn.verifyJwt) args.push('--no-verify-jwt')
  console.log(`Deploy ${fn.name}...`)
  execFileSync('npx', args, { cwd: root, stdio: 'inherit', env: process.env, shell: true })
}

// Secrets Resend per email notifiche
const resendKey = process.env.SMTP_PASS?.trim()
const fromEmail = process.env.SMTP_ADMIN_EMAIL?.trim() || 'no-reply@vcuria.app'
const senderName = 'Cambia-Menti Formazione'
if (resendKey && resendKey !== 're_INCOLLA_API_KEY') {
  const adminEmail =
    fromEmail === 'onboarding@resend.dev' ? 'no-reply@vcuria.app' : fromEmail
  const pairs = {
    RESEND_API_KEY: resendKey,
    NOTIFICATION_FROM_EMAIL: adminEmail,
    NOTIFICATION_FROM_NAME: senderName,
    APP_ORIGIN: 'https://cambiamenti.vcuria.app',
  }
  const cron =
    process.env.CRON_SECRET?.trim() ||
    process.env.NOTIFICATION_CRON_SECRET?.trim()
  if (cron) pairs.CRON_SECRET = cron

  console.log('Imposto secrets edge functions...')
  const { writeFileSync, unlinkSync } = await import('node:fs')
  const envFile = path.join(
    process.env.TEMP || os.tmpdir(),
    `cm-fn-secrets-${Date.now()}.env`,
  )
  writeFileSync(
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
      unlinkSync(envFile)
    } catch {
      /* ignore */
    }
  }
} else {
  console.warn('SKIP secrets: SMTP_PASS assente o ancora placeholder in secrets.env')
}

console.log('OK edge functions')
