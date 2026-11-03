import { z } from 'zod'
import { buildDocumentStoragePath } from '../../../../../src/lib/documentStoragePath'
import { audit } from '../audit'
import { dbError } from '../db'
import { text, wordsFilter, type McpCtx } from '../context'
import { DOCUMENT_CATEGORIES, mimeForFile } from './documenti'

const PEC_STATUSES = ['nuova', 'elaborata', 'da_verificare', 'ignorata', 'verificata'] as const

export function registerMailTools({ server, db, auth }: McpCtx): void {
  server.registerTool(
    'posta_da_elaborare',
    {
      description:
        "Elenco delle PEC di Cambia-Menti copiate nel gestionale (dalla più vecchia). Predefinito: quelle nuove, ancora da elaborare. Per ognuna usa leggi_pec, aggiorna il gestionale e poi segna_pec.",
      inputSchema: z.object({
        stato: z.enum(PEC_STATUSES).optional(),
        testo: z.string().optional().describe('Parole nell’oggetto o nel mittente'),
        limite: z.number().int().min(1).max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ stato = 'nuova', testo, limite }) => {
      let q = db
        .from('pec_messages')
        .select('id, sent_at, direction, mailbox, from_address, subject, status, claude_note, course_ids, pec_attachments(id, file_name)')
        .eq('status', stato)
        .order('sent_at', { ascending: stato === 'nuova', nullsFirst: false })
        .limit(limite ?? 20)
      const filter = testo ? wordsFilter(testo, ['subject', 'from_address']) : null
      if (filter) q = q.or(filter)
      const [{ data, error }, counts] = await Promise.all([
        q,
        db.from('pec_messages').select('id', { count: 'exact', head: true }).eq('status', 'nuova'),
      ])
      if (error) throw dbError(error, 'Lettura PEC')
      return text({ nuove_in_totale: counts.count ?? null, pec: data })
    },
  )

  server.registerTool(
    'leggi_pec',
    {
      description: 'Testo completo di una PEC con il testo estratto dagli allegati PDF (anche firmati .p7m). Gli allegati scansionati non hanno testo: leggili con leggi_allegato_pec.',
      inputSchema: z.object({
        id: z.string().uuid(),
        max_caratteri_allegato: z.number().int().min(500).max(100_000).optional().describe('Predefinito 15000 per allegato'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ id, max_caratteri_allegato = 15_000 }) => {
      const { data, error } = await db
        .from('pec_messages')
        .select('*, pec_attachments(id, file_name, mime_type, size_bytes, text_content, document_id, storage_path)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw dbError(error, 'Lettura PEC')
      if (!data) throw new Error('PEC non trovata')
      const attachments = ((data.pec_attachments ?? []) as { text_content: string; storage_path: string | null }[]).map((a) => ({
        ...a,
        storage_path: undefined,
        disponibile: Boolean(a.storage_path),
        text_content: a.text_content.length > max_caratteri_allegato ? `${a.text_content.slice(0, max_caratteri_allegato)}\n[… testo tagliato]` : a.text_content,
        senza_testo: !a.text_content,
      }))
      return text({ ...data, pec_attachments: attachments })
    },
  )

  server.registerTool(
    'leggi_allegato_pec',
    {
      description: 'Allega il file di un allegato PEC (fino a 4 MB), per leggere PDF scansionati o immagini.',
      inputSchema: z.object({ allegato_id: z.string().uuid() }),
      annotations: { readOnlyHint: true },
    },
    async ({ allegato_id }) => {
      const { data: a, error } = await db.from('pec_attachments').select('id, file_name, size_bytes, storage_path').eq('id', allegato_id).maybeSingle()
      if (error) throw dbError(error, 'Lettura allegato')
      if (!a?.storage_path) throw new Error('Allegato non disponibile')
      if (Number(a.size_bytes) > 4 * 1024 * 1024) throw new Error('Allegato oltre 4 MB')
      const file = await db.storage.from('documents').download(a.storage_path as string)
      if (file.error || !file.data) throw dbError(file.error, 'Download allegato')
      const bytes = new Uint8Array(await file.data.arrayBuffer())
      let bin = ''
      for (const b of bytes) bin += String.fromCharCode(b)
      return {
        content: [
          { type: 'text' as const, text: a.file_name as string },
          {
            type: 'resource' as const,
            resource: { uri: `cambiamenti://pec/allegati/${a.id}`, mimeType: mimeForFile(a.file_name as string) ?? 'application/octet-stream', blob: btoa(bin) },
          },
        ],
      }
    },
  )

  server.registerTool(
    'segna_pec',
    {
      description:
        "Segna l'esito di una PEC: elaborata = gestionale aggiornato (scrivi cosa hai fatto), da_verificare = serve una persona (scrivi cosa controllare), ignorata = non riguarda i corsi. Indica i corsi interessati.",
      inputSchema: z.object({
        id: z.string().uuid(),
        stato: z.enum(['elaborata', 'da_verificare', 'ignorata']),
        nota: z.string().min(3).max(2000).describe('In italiano, breve: cosa dice la PEC e cosa hai aggiornato'),
        corso_ids: z.array(z.string().uuid()).max(30).optional(),
      }),
      annotations: { idempotentHint: true },
    },
    async (args) => {
      const { data, error } = await db
        .from('pec_messages')
        .update({
          status: args.stato,
          claude_note: args.nota,
          course_ids: args.corso_ids ?? [],
          processed_at: new Date().toISOString(),
          processed_by: auth.userId,
        })
        .eq('id', args.id)
        .select('id, subject, status')
        .single()
      if (error) throw dbError(error, 'Aggiornamento PEC')
      const warning = await audit(db, {
        tool: 'segna_pec',
        courseId: args.corso_ids?.[0] ?? null,
        summary: `PEC «${String(data.subject).slice(0, 120)}»: ${args.stato} — ${args.nota}`,
        args,
      })
      return text({ aggiornata: data, avviso: warning })
    },
  )

  server.registerTool(
    'allega_pec_a_corso',
    {
      description:
        "Copia un allegato di una PEC nei documenti di un corso (decreti, verbali, note della Regione, comunicazioni). Se l'allegato è già un documento lo collega anche a questo corso. I verbali di indennità vanno come documento normale (categoria report), non con «Carica verbale».",
      inputSchema: z.object({
        allegato_id: z.string().uuid(),
        corso_id: z.string().uuid(),
        categoria: z.enum(DOCUMENT_CATEGORIES),
        titolo: z.string().min(1).max(200).optional(),
      }),
    },
    async (args) => {
      const { data: a, error } = await db
        .from('pec_attachments')
        .select('id, file_name, size_bytes, storage_path, document_id')
        .eq('id', args.allegato_id)
        .maybeSingle()
      if (error) throw dbError(error, 'Lettura allegato')
      if (!a) throw new Error('Allegato non trovato')
      if (a.document_id) {
        const link = await db.from('document_courses').upsert({ document_id: a.document_id, course_id: args.corso_id }, { ignoreDuplicates: true })
        if (link.error) throw dbError(link.error, 'Collegamento documento')
        const warning = await audit(db, { tool: 'allega_pec_a_corso', courseId: args.corso_id, summary: `Collegato ${a.file_name}`, args })
        return text({ collegato: a.document_id, avviso: warning })
      }
      if (!a.storage_path) throw new Error('Allegato non disponibile nel gestionale')
      const fileName = a.file_name as string
      const path = buildDocumentStoragePath({ courseId: args.corso_id, fileName })
      const copy = await db.storage.from('documents').copy(a.storage_path as string, path)
      if (copy.error) throw dbError(copy.error, 'Copia allegato')
      const { data: doc, error: e2 } = await db
        .from('documents')
        .insert({
          course_id: args.corso_id,
          category: args.categoria,
          title: args.titolo ?? fileName,
          file_name: fileName,
          storage_path: path,
          mime_type: mimeForFile(fileName) ?? 'application/octet-stream',
          size_bytes: a.size_bytes,
          uploaded_by: auth.userId,
        })
        .select('id, title, category, course_id')
        .single()
      if (e2) {
        await db.storage.from('documents').remove([path])
        throw dbError(e2, 'Registrazione documento')
      }
      await db.from('pec_attachments').update({ document_id: doc.id }).eq('id', a.id)
      const warning = await audit(db, { tool: 'allega_pec_a_corso', courseId: args.corso_id, summary: `Allegato PEC «${doc.title}» caricato`, args })
      return text({ caricato: doc, avviso: warning })
    },
  )
}
