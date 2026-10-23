/**
 * Fatture Aruba dal PC, senza API: usa il pannello web con un browser automatico.
 *
 *   npm run aruba -- sincronizza [anni...] [--nascosto]
 *                                       scarica da Aruba emesse e ricevute che mancano in Cambiamenti
 *                                       e aggiorna lo stato SdI delle emesse
 *   npm run aruba -- invia              carica nelle bozze di Aruba le fatture preparate in Cambiamenti
 *                                       (chiede conferma per ognuna; l'invio allo SdI lo fai dal pannello)
 *   npm run aruba -- anagrafiche        crea clienti/fornitori e corsisti EIPASS dalle fatture già importate
 *   npm run aruba -- servizio [--ogni 6] resta acceso: esegue il tasto «Sincronizza con Aruba» del
 *                                       gestionale e sincronizza da solo ogni 6 ore (0 = mai)
 *   npm run aruba -- installa-servizio [--ogni 6]
 *                                       fa partire il servizio da solo all'accesso a Windows
 *   npm run aruba -- disinstalla-servizio
 *   npm run aruba -- accedi              apre il pannello e salva la sessione (OTP compreso)
 *   npm run aruba -- esplora             registra com'è fatto il pannello (per completare lo script)
 *   npm run aruba -- codice              scarica il codice pubblico del pannello (per lo sviluppo)
 *   npm run aruba -- importa <percorso>  importa in Cambiamenti XML/P7M/ZIP da file o cartella
 */
import fs from 'node:fs'
import path from 'node:path'
import { importInvoiceBytes, linkInvoiceParties } from '../../src/services/invoiceImportCore'
import { supabaseAdmin } from './env'
import { ensureLoggedIn, explainBrowserError, openBrowser } from './browser'
import { explore } from './explore'
import { downloadBundle } from './bundle'
import { syncFromAruba, uploadDrafts } from './sync'
import { installService, runService, uninstallService } from './service'

function listFiles(target: string): string[] {
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(path.join(target, e.name)) : [path.join(target, e.name)]))
    .filter((f) => /\.(xml|p7m|zip)$/i.test(f))
}

export async function importPaths(targets: string[]): Promise<void> {
  const files = targets.flatMap((t) => listFiles(path.resolve(t)))
  if (!files.length) {
    console.log('Nessun file XML, P7M o ZIP trovato.')
    return
  }
  console.log(`Importo ${files.length} file in Cambiamenti...`)
  const raw = files.map((f) => ({ name: path.basename(f), bytes: new Uint8Array(fs.readFileSync(f)) }))
  const client = await supabaseAdmin()
  const result = await importInvoiceBytes(client, raw, (done, total) => {
    if (done < total) process.stdout.write(`\r  ${done + 1}/${total}`)
  })
  console.log(
    `\nNuove: ${result.added} · aggiornate: ${result.updated} · clienti/fornitori creati: ${result.partiesCreated} · corsisti EIPASS creati: ${result.eipassCreated} · abbinate a corsisti EIPASS: ${result.eipassLinked} · collegate ai corsi: ${result.coursesLinked}`,
  )
  for (const line of result.report) console.log(`  - ${line}`)
}

async function login(): Promise<void> {
  const context = await openBrowser()
  const page = context.pages()[0] ?? (await context.newPage())
  await ensureLoggedIn(page)
  console.log('Accesso fatto: la sessione è salvata. Puoi chiudere la finestra.')
  await new Promise<void>((resolve) => context.on('close', () => resolve()))
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const hidden = rest.includes('--nascosto')
  const everyAt = rest.indexOf('--ogni')
  const everyHours = everyAt >= 0 ? Number(rest[everyAt + 1]) : 6
  if (!Number.isFinite(everyHours) || everyHours < 0) throw new Error('--ogni vuole un numero di ore (0 = mai)')
  const args = rest.filter((a, i) => !a.startsWith('--') && !(everyAt >= 0 && i === everyAt + 1))
  switch (command) {
    case 'sincronizza': {
      const years = args.map(Number).filter((y) => y > 2000)
      return syncFromAruba({ years: years.length ? years : [new Date().getFullYear()], hidden })
    }
    case 'servizio':
      return runService({ everyHours })
    case 'installa-servizio':
      return installService(everyHours)
    case 'disinstalla-servizio':
      return uninstallService()
    case 'invia':
      return uploadDrafts({ hidden })
    case 'accedi':
      return login()
    case 'esplora':
      return explore()
    case 'anagrafiche': {
      const res = await linkInvoiceParties(await supabaseAdmin())
      console.log(
        `Clienti/fornitori creati: ${res.partiesCreated} · fatture collegate: ${res.linked} · ` +
          `corsisti EIPASS creati: ${res.eipassCreated} · fatture collegate a corsisti: ${res.eipassLinked} · fatture collegate ai corsi: ${res.coursesLinked}`,
      )
      for (const line of res.report) console.log(`  - ${line}`)
      return
    }
    case 'codice':
      return downloadBundle()
    case 'importa':
      if (!args.length) throw new Error('Indica il file o la cartella: npm run aruba -- importa <percorso>')
      return importPaths(args)
    default:
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?|^ \*/gm, ''))
  }
}

main().catch((err) => {
  console.error(`Errore: ${explainBrowserError(err)}`)
  process.exit(1)
})
