import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const envFile = path.join(root, 'lg-edil', 'apps', 'api', '.env.api.prod')
const NEW_REF = process.env.SPLIT_LG_REF || 'mtgjjldcljzyyythuyho'
const OLD_REF = process.env.SPLIT_OLD_REF || 'nmmjivrsuezhptwsfqdv'

export function buildLgDatabaseUrl() {
  const raw = fs.readFileSync(envFile, 'utf8')
  const m = raw.match(/^DATABASE_URL=(.+)$/m)
  if (!m) throw new Error(`DATABASE_URL mancante in ${envFile}`)
  let url = m[1].trim()
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1)
  }
  return url.replace(`postgres.${OLD_REF}`, `postgres.${NEW_REF}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(buildLgDatabaseUrl())
}
