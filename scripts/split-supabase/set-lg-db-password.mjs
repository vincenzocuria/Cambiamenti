import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getSupabaseAccessToken } from '../lib/supabaseAccessToken.mjs'

const LG_REF = process.env.SPLIT_LG_REF || 'mtgjjldcljzyyythuyho'
const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lg-edil-db.env')

async function main() {
  const token = getSupabaseAccessToken()
  if (!token) throw new Error('Token Supabase mancante')
  const password = `LgEdil_${crypto.randomBytes(18).toString('base64url')}`
  const res = await fetch(`https://api.supabase.com/v1/projects/${LG_REF}/database/password`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) throw new Error(`PATCH password: ${res.status} ${await res.text()}`)

  const databaseUrl =
    `postgresql+psycopg://postgres.${LG_REF}:${encodeURIComponent(password)}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require`

  fs.writeFileSync(
    outFile,
    `# Generato da set-lg-db-password.mjs — non committare\nDATABASE_URL=${databaseUrl}\n`,
    'utf8',
  )
  console.log(`Scritto ${outFile}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
