import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAuthEmailCatalog } from './lib/authEmailCatalog.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'supabase', 'templates')

fs.mkdirSync(outDir, { recursive: true })

const catalog = buildAuthEmailCatalog()
for (const meta of Object.values(catalog)) {
  const filePath = path.join(outDir, meta.file)
  fs.writeFileSync(filePath, meta.html, 'utf8')
  console.log(`wrote ${path.relative(root, filePath)}`)
}

console.log(`OK ${Object.keys(catalog).length} template`)
