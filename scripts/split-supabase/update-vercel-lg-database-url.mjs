import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lg-edil-db.env')
const apiDir = path.join(root, 'lg-edil', 'apps', 'api')

function readDatabaseUrl() {
  const raw = fs.readFileSync(envFile, 'utf8')
  const m = raw.match(/^DATABASE_URL=(.+)$/m)
  if (!m) throw new Error(`DATABASE_URL mancante in ${envFile}`)
  return m[1].trim()
}

function main() {
  const databaseUrl = readDatabaseUrl()
  console.log('Aggiorno DATABASE_URL su Vercel (lg-edil-api, production)...')
  execFileSync(
    'npx',
    ['vercel', 'env', 'update', 'DATABASE_URL', 'production', '--value', databaseUrl, '--yes'],
    { cwd: apiDir, stdio: 'inherit', shell: true },
  )
  console.log('Fatto. Rideploy consigliato: npx vercel deploy --prod dalla cartella API.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
