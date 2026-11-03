/**
 * Copia nel gestionale le PEC nuove (sola lettura sulla casella: nessun flag cambiato).
 * Riprende dall'ultimo UID salvato per casella e cartella.
 */
import path from 'node:path'
import { ImapFlow } from 'imapflow'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadEnvFile } from '../lib/loadEnvFile.mjs'
import { repoRoot } from '../aruba-sync/env'
import { parsePec, safeFileName, storageMime } from './extract'

loadEnvFile(path.join(repoRoot, '..', 'Global Res', '.env'), [
  'CAMBIAMENTI_PEC_IMAP_HOST',
  'CAMBIAMENTI_PEC_IMAP_PORT',
  'CAMBIAMENTI_PEC_SRL_ADDRESS',
  'CAMBIAMENTI_PEC_SRL_PASSWORD',
  'CAMBIAMENTI_PEC_CALABRIA_ADDRESS',
  'CAMBIAMENTI_PEC_CALABRIA_PASSWORD',
])

const FOLDERS: { path: string; direction: 'in' | 'out' }[] = [
  { path: 'INBOX', direction: 'in' },
  { path: 'INBOX.Inviata', direction: 'out' },
]

interface Mailbox {
  key: string
  address: string
  password: string
}

function mailboxes(): Mailbox[] {
  const out: Mailbox[] = []
  for (const key of ['SRL', 'CALABRIA']) {
    const address = process.env[`CAMBIAMENTI_PEC_${key}_ADDRESS`]?.trim()
    const password = process.env[`CAMBIAMENTI_PEC_${key}_PASSWORD`]?.trim()
    if (address && password) out.push({ key: key.toLowerCase(), address, password })
  }
  return out
}

async function lastUid(db: SupabaseClient, mailbox: string, folder: string): Promise<number> {
  const { data, error } = await db
    .from('pec_messages')
    .select('uid')
    .eq('mailbox', mailbox)
    .eq('folder', folder)
    .order('uid', { ascending: false })
    .limit(1)
  if (error) throw new Error(`Lettura ultimo UID: ${error.message}`)
  return Number(data?.[0]?.uid ?? 0)
}

async function saveMessage(
  db: SupabaseClient,
  box: Mailbox,
  folder: { path: string; direction: 'in' | 'out' },
  uid: number,
  raw: Buffer,
): Promise<string> {
  const pec = await parsePec(raw)
  const { data, error } = await db
    .from('pec_messages')
    .upsert(
      {
        mailbox: box.address,
        folder: folder.path,
        uid,
        message_id: pec.messageId,
        direction: folder.direction,
        from_address: pec.from,
        to_addresses: pec.to,
        subject: pec.subject,
        sent_at: pec.sentAt,
        body_text: pec.text,
        status: pec.isReceipt ? 'ignorata' : 'nuova',
        claude_note: pec.isReceipt ? 'Ricevuta PEC (accettazione/consegna)' : '',
      },
      { onConflict: 'mailbox,folder,uid', ignoreDuplicates: true },
    )
    .select('id')
  if (error) throw new Error(`Salvataggio PEC ${uid}: ${error.message}`)
  const id = data?.[0]?.id as string | undefined
  if (!id) return 'già presente'
  if (pec.isReceipt) return 'ricevuta'

  for (const a of pec.attachments) {
    const storagePath = `pec/${id}/${crypto.randomUUID()}-${safeFileName(a.fileName)}`
    const up = await db.storage.from('documents').upload(storagePath, a.content, { contentType: storageMime(a.fileName) })
    const { error: e2 } = await db.from('pec_attachments').insert({
      message_id: id,
      file_name: a.fileName,
      mime_type: a.mimeType,
      size_bytes: a.content.length,
      storage_path: up.error ? null : storagePath,
      text_content: a.text,
    })
    if (e2) throw new Error(`Allegato ${a.fileName}: ${e2.message}`)
  }
  return `${pec.attachments.length} allegati`
}

export async function syncPec(db: SupabaseClient, log: (line: string) => void = console.log): Promise<number> {
  const host = process.env.CAMBIAMENTI_PEC_IMAP_HOST?.trim()
  const port = Number(process.env.CAMBIAMENTI_PEC_IMAP_PORT ?? 993)
  if (!host) throw new Error('CAMBIAMENTI_PEC_IMAP_HOST mancante in Global Res/.env')
  const boxes = mailboxes()
  if (!boxes.length) throw new Error('Credenziali PEC mancanti in Global Res/.env')
  let added = 0
  for (const box of boxes) {
    const client = new ImapFlow({ host, port, secure: true, auth: { user: box.address, pass: box.password }, logger: false })
    await client.connect()
    try {
      for (const folder of FOLDERS) {
        const since = await lastUid(db, box.address, folder.path)
        const lock = await client.getMailboxLock(folder.path, { readOnly: true }).catch(() => null)
        if (!lock) continue
        try {
          const mailbox = client.mailbox
          if (!mailbox || mailbox.exists === 0) continue
          const uids: number[] = []
          for await (const m of client.fetch(`${since + 1}:*`, { uid: true }, { uid: true })) if (m.uid > since) uids.push(m.uid)
          for (const uid of uids) {
            const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
            if (!msg || !msg.source) continue
            const result = await saveMessage(db, box, folder, uid, msg.source)
            if (result !== 'già presente') added++
            log(`  ${box.key} ${folder.path} #${uid}: ${result}`)
          }
        } finally {
          lock.release()
        }
      }
    } finally {
      await client.logout().catch(() => undefined)
    }
  }
  return added
}
