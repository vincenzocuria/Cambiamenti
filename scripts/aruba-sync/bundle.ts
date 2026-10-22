import fs from 'node:fs'
import path from 'node:path'
import { dataDir } from './env'
import { panelUrl } from './browser'

/**
 * Scarica il codice pubblico del pannello Aruba (ExtJS, nessun login) in .data/pannello/, per
 * leggere nomi e parametri delle chiamate interne (fatture emesse, caricamento XML).
 */
export async function downloadBundle(): Promise<void> {
  const out = path.join(dataDir, 'pannello')
  fs.mkdirSync(out, { recursive: true })
  const base = new URL(panelUrl)
  const manifest = (await (await fetch(new URL('app.json', base))).json()) as {
    js?: { path: string }[]
    css?: { path: string }[]
  }
  fs.writeFileSync(path.join(out, 'app.json'), JSON.stringify(manifest, null, 2))
  const files = [...(manifest.js ?? [])].map((f) => f.path)
  const index = await (await fetch(base)).text()
  fs.writeFileSync(path.join(out, 'index.html'), index)
  for (const m of index.matchAll(/<script[^>]+src="([^"]+)"/g)) files.push(m[1])
  const endpoints = new Set<string>()
  for (const rel of new Set(files)) {
    const url = new URL(rel, base)
    if (url.host !== base.host) continue
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`  ${rel}: ${res.status}`)
      continue
    }
    const code = await res.text()
    const name = rel.replace(/[^a-z0-9._-]+/gi, '_').slice(-120)
    fs.writeFileSync(path.join(out, name), code)
    for (const m of code.matchAll(/["'`/]((?:services|api)\/[A-Za-z0-9_/{}.-]+)/g)) endpoints.add(m[1])
    console.log(`  ${rel} (${Math.round(code.length / 1024)} KB)`)
  }
  fs.writeFileSync(path.join(out, 'endpoint.txt'), [...endpoints].sort().join('\n'))
  console.log(`Salvato in ${out} (${endpoints.size} chiamate trovate)`)
}
