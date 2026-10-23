/**
 * Servizio sul PC: esegue le sincronizzazioni chieste dal tasto «Sincronizza con Aruba» del
 * gestionale e ne fa una da solo ogni tot ore. Segnala al gestionale che il PC è acceso.
 *
 *   npm run aruba -- servizio [--ogni 6]     resta acceso e lavora (ore tra le sincronizzazioni automatiche)
 *   npm run aruba -- installa-servizio        lo fa partire da solo all'accesso a Windows, senza finestra
 *   npm run aruba -- disinstalla-servizio     lo toglie dall'avvio automatico
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { SupabaseClient } from '@supabase/supabase-js'
import { dataDir, repoRoot, supabaseAdmin } from './env'
import { explainBrowserError } from './browser'
import { syncFromAruba } from './sync'
import { linkAllInvoiceCourses } from '../../src/services/invoiceImportCore'
import { autoSyncDue, defaultYears } from '../../src/lib/arubaSync'

const TASK_NAME = 'Cambiamenti - sincronizzazione Aruba'
const POLL_MS = 15_000
const HEARTBEAT_MS = 30_000

interface SyncRequest {
  id: string
  source: 'manual' | 'auto'
  years: number[]
  status: string
  created_at: string
  finished_at: string | null
}

/** Un solo servizio per PC: il file di blocco tiene il pid di quello acceso. */
function acquireLock(): boolean {
  fs.mkdirSync(dataDir, { recursive: true })
  const lock = path.join(dataDir, 'servizio.pid')
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8'))
    try {
      if (pid && pid !== process.pid) {
        process.kill(pid, 0)
        return false
      }
    } catch {
      // processo non più vivo: il blocco è vecchio
    }
  }
  fs.writeFileSync(lock, String(process.pid))
  const release = () => {
    try {
      if (Number(fs.readFileSync(lock, 'utf8')) === process.pid) fs.unlinkSync(lock)
    } catch {
      // ignorato
    }
  }
  process.on('exit', release)
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      release()
      process.exit(0)
    })
  return true
}

function stamp() {
  return new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
}

/** Esegue la sincronizzazione raccogliendo quello che scrive, per mostrarlo nel gestionale. */
async function runRequest(client: SupabaseClient, req: SyncRequest): Promise<void> {
  const years = req.years?.length ? req.years : defaultYears()
  const lines: string[] = []
  const original = console.log
  console.log = (...args: unknown[]) => {
    const text = args.map(String).join(' ')
    lines.push(text.trim())
    original(...args)
  }
  let status: 'done' | 'error' = 'done'
  let message = ''
  try {
    original(`[${stamp()}] Sincronizzazione ${req.source === 'auto' ? 'automatica' : 'chiesta dal gestionale'}: ${years.join(', ')}`)
    await syncFromAruba({ years, hidden: true })
    // Note di debito di corsi aggiunti dopo l'importazione
    const linked = await linkAllInvoiceCourses(client)
    if (linked) console.log(`  fatture collegate ai corsi: ${linked}`)
    const fresh = lines.filter((l) => /da scaricare|importate|aggiornato|segnato|collegate ai corsi/.test(l))
    message = fresh.length ? fresh.join(' · ') : 'Sincronizzazione finita'
  } catch (err) {
    status = 'error'
    message = explainBrowserError(err)
    original(`Errore: ${message}`)
  } finally {
    console.log = original
  }
  const { error } = await client
    .from('aruba_sync_requests')
    .update({ status, message: message.slice(0, 2000), log: lines.filter(Boolean).slice(-200), finished_at: new Date().toISOString() })
    .eq('id', req.id)
  if (error) console.error(`Esito non salvato: ${error.message}`)
}

/** Prende la richiesta più vecchia in attesa (se un altro PC non l'ha già presa). */
async function claimPending(client: SupabaseClient): Promise<SyncRequest | null> {
  const { data, error } = await client
    .from('aruba_sync_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at')
    .limit(1)
  if (error) throw error
  const next = (data as SyncRequest[])[0]
  if (!next) return null
  const { data: claimed, error: e2 } = await client
    .from('aruba_sync_requests')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', next.id)
    .eq('status', 'pending')
    .select('*')
  if (e2) throw e2
  return (claimed as SyncRequest[])[0] ?? null
}

async function lastFinished(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client
    .from('aruba_sync_requests')
    .select('finished_at')
    .in('status', ['done', 'error'])
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(1)
  if (error) throw error
  return (data as { finished_at: string | null }[])[0]?.finished_at ?? null
}

export async function runService(opts: { everyHours: number }): Promise<void> {
  if (!acquireLock()) {
    console.log('Il servizio è già acceso su questo PC.')
    return
  }
  const client = await supabaseAdmin()
  const agentId = os.hostname()
  let busy = false

  const beat = async () => {
    const { error } = await client
      .from('aruba_agents')
      .upsert({ id: agentId, last_seen_at: new Date().toISOString(), busy })
    if (error) console.error(`[${stamp()}] Segnale al gestionale non riuscito: ${error.message}`)
  }

  // Richieste rimaste «in corso» da un avvio interrotto
  await client
    .from('aruba_sync_requests')
    .update({ status: 'error', message: 'Interrotta: il servizio sul PC si è fermato', finished_at: new Date().toISOString() })
    .eq('status', 'running')

  await beat()
  setInterval(() => void beat(), HEARTBEAT_MS)
  console.log(
    `[${stamp()}] Servizio Aruba acceso su ${agentId}. Aspetto le richieste dal gestionale` +
      (opts.everyHours > 0 ? ` e sincronizzo da solo ogni ${opts.everyHours} ore.` : '.'),
  )

  for (;;) {
    try {
      let req = await claimPending(client)
      if (!req && autoSyncDue(await lastFinished(client), opts.everyHours)) {
        const { data, error } = await client
          .from('aruba_sync_requests')
          .insert({ source: 'auto', years: defaultYears(), status: 'running', started_at: new Date().toISOString(), requested_by: null })
          .select('*')
          .single()
        if (error) throw error
        req = data as SyncRequest
      }
      if (req) {
        busy = true
        await beat()
        await runRequest(client, req)
        busy = false
        await beat()
      }
    } catch (err) {
      busy = false
      console.error(`[${stamp()}] ${err instanceof Error ? err.message : err}`)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

/** Avvio automatico all'accesso a Windows, senza finestra (Utilità di pianificazione). */
export function installService(everyHours: number): void {
  if (process.platform !== 'win32') throw new Error('L’avvio automatico si installa solo su Windows')
  fs.mkdirSync(dataDir, { recursive: true })
  const cmd = path.join(dataDir, 'servizio.cmd')
  const vbs = path.join(dataDir, 'servizio.vbs')
  const log = path.join(dataDir, 'servizio.log')
  fs.writeFileSync(
    cmd,
    `@echo off\r\ncd /d "${repoRoot}"\r\ncall npm run aruba -- servizio --ogni ${everyHours} >> "${log}" 2>&1\r\n`,
  )
  // wscript avvia il .cmd nascosto (0 = nessuna finestra)
  fs.writeFileSync(vbs, `CreateObject("WScript.Shell").Run """${cmd}""", 0, False\r\n`)
  execFileSync('schtasks', ['/Create', '/F', '/TN', TASK_NAME, '/SC', 'ONLOGON', '/RL', 'LIMITED', '/TR', `wscript.exe "${vbs}"`], {
    stdio: 'inherit',
  })
  execFileSync('schtasks', ['/Run', '/TN', TASK_NAME], { stdio: 'inherit' })
  console.log(
    `Servizio installato: parte da solo quando accedi a Windows ed è già acceso ora.\nRegistro: ${log}`,
  )
}

export function uninstallService(): void {
  if (process.platform !== 'win32') throw new Error('Solo su Windows')
  execFileSync('schtasks', ['/Delete', '/F', '/TN', TASK_NAME], { stdio: 'inherit' })
  const lock = path.join(dataDir, 'servizio.pid')
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8'))
    try {
      if (pid) process.kill(pid)
    } catch {
      // già spento
    }
  }
  console.log('Servizio tolto dall’avvio automatico e spento.')
}
