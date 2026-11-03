/**
 * PEC di Cambia-Menti nel gestionale (sola lettura sulle caselle Aruba).
 *
 *   npm run pec -- sincronizza     copia nel gestionale le PEC nuove con allegati e testo dei PDF
 *
 * Il servizio Aruba sul PC (npm run aruba -- servizio) lo fa da solo una volta al giorno.
 * Claude le elabora con il connettore MCP; la pagina «Posta da verificare» mostra l'esito.
 */
import { supabaseAdmin } from '../aruba-sync/env'
import { syncPec } from './sync'

const [command = 'sincronizza'] = process.argv.slice(2)

async function main() {
  if (command !== 'sincronizza') {
    console.log('Uso: npm run pec -- sincronizza')
    return
  }
  const added = await syncPec(await supabaseAdmin())
  console.log(`PEC nuove copiate nel gestionale: ${added}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
