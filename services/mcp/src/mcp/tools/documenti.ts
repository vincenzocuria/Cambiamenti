import { z } from 'zod'
import { buildDocumentStoragePath } from '../../../../../src/lib/documentStoragePath'
import { base64ToBytes } from '../../lib/crypto'
import { audit } from '../audit'
import { dbError } from '../db'
import { text, type McpCtx } from '../context'

const BUCKET = 'documents'
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_INLINE_BYTES = 4 * 1024 * 1024

export const DOCUMENT_CATEGORIES = ['identity', 'module', 'appointment', 'curriculum', 'certificate', 'other', 'generated', 'report', 'declaration'] as const
const PERSON_TYPES = ['student', 'teacher', 'tutor', 'admin_staff', 'staff'] as const

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  p7m: 'application/pkcs7-mime',
  p7s: 'application/pkcs7-signature',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain',
  zip: 'application/zip',
}

export function mimeForFile(fileName: string): string | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return MIME_BY_EXT[ext] ?? null
}

export function registerDocumentTools({ server, db, auth }: McpCtx): void {
  server.registerTool(
    'leggi_documento',
    {
      description:
        "Dati di un documento del gestionale e un link di download valido 10 minuti. Con includi_contenuto=true allega anche il file (fino a 4 MB) per leggerlo.",
      inputSchema: z.object({ id: z.string().uuid(), includi_contenuto: z.boolean().optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ id, includi_contenuto }) => {
      const { data: doc, error } = await db
        .from('documents')
        .select('id, title, category, file_name, mime_type, size_bytes, storage_path, course_id, person_type, person_id, created_at, document_courses(course_id)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw dbError(error, 'Lettura documento')
      if (!doc) throw new Error('Documento non trovato')
      const signed = await db.storage.from(BUCKET).createSignedUrl(doc.storage_path as string, 600)
      const info = { ...doc, link_download: signed.data?.signedUrl ?? null }
      if (!includi_contenuto) return text(info)
      if (Number(doc.size_bytes ?? 0) > MAX_INLINE_BYTES) return text({ ...info, nota: 'File oltre 4 MB: usa il link di download' })
      const file = await db.storage.from(BUCKET).download(doc.storage_path as string)
      if (file.error || !file.data) throw dbError(file.error, 'Download documento')
      const bytes = new Uint8Array(await file.data.arrayBuffer())
      let bin = ''
      for (const b of bytes) bin += String.fromCharCode(b)
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(info, null, 2) },
          {
            type: 'resource' as const,
            resource: { uri: `cambiamenti://documenti/${doc.id}`, mimeType: (doc.mime_type as string) || 'application/octet-stream', blob: btoa(bin) },
          },
        ],
      }
    },
  )

  server.registerTool(
    'carica_documento',
    {
      description:
        "Carica un file (es. PDF di una PEC: decreto, verbale, nota) nei documenti di un corso e/o di una persona. Attenzione: i verbali di indennità vanno caricati qui come documento normale, non con «Carica verbale» del sito, per non contarli due volte nei saldi.",
      inputSchema: z.object({
        corso_id: z.string().uuid().optional(),
        persona_id: z.string().uuid().optional(),
        tipo_persona: z.enum(PERSON_TYPES).optional().describe('Obbligatorio con persona_id'),
        categoria: z.enum(DOCUMENT_CATEGORIES).describe('report=verbali/rendiconti, declaration=dichiarazioni, appointment=incarichi, other=altro'),
        titolo: z.string().min(1).max(200),
        nome_file: z.string().min(1).max(200),
        contenuto_base64: z.string().min(1),
      }),
    },
    async (args) => {
      const { corso_id, persona_id, tipo_persona, categoria, titolo, nome_file, contenuto_base64 } = args
      if (!corso_id && !persona_id) throw new Error('Indica almeno corso_id o persona_id')
      if (persona_id && !tipo_persona) throw new Error('Con persona_id serve tipo_persona')
      const mime = mimeForFile(nome_file)
      if (!mime) throw new Error('Tipo di file non ammesso (pdf, p7m, doc/x, xls/x, jpg, png, txt, zip)')
      const bytes = base64ToBytes(contenuto_base64)
      if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw new Error('File vuoto o oltre 15 MB')

      const path = buildDocumentStoragePath({ personType: persona_id ? tipo_persona : null, personId: persona_id ?? null, courseId: corso_id ?? null, fileName: nome_file })
      const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime })
      if (up.error) throw dbError(up.error, 'Caricamento file')
      const { data, error } = await db
        .from('documents')
        .insert({
          person_type: persona_id ? tipo_persona : null,
          person_id: persona_id ?? null,
          course_id: corso_id ?? null,
          category: categoria,
          title: titolo,
          file_name: nome_file,
          storage_path: path,
          mime_type: mime,
          size_bytes: bytes.length,
          uploaded_by: auth.userId,
        })
        .select('id, title, category, file_name, course_id, person_id, created_at')
        .single()
      if (error) {
        await db.storage.from(BUCKET).remove([path])
        throw dbError(error, 'Registrazione documento')
      }
      const warning = await audit(db, { tool: 'carica_documento', courseId: corso_id, summary: `Caricato «${titolo}» (${nome_file})`, args })
      return text({ caricato: data, avviso: warning })
    },
  )

  server.registerTool(
    'prepara_caricamento',
    {
      description:
        "Per file grandi (oltre ~200 KB): restituisce un indirizzo di caricamento valido 2 ore. Si carica il file con una richiesta HTTP PUT (es. curl -X PUT --data-binary @file -H 'Content-Type: <mime>' '<url>') e poi si chiama registra_documento con il percorso indicato.",
      inputSchema: z.object({
        corso_id: z.string().uuid().optional(),
        persona_id: z.string().uuid().optional(),
        tipo_persona: z.enum(PERSON_TYPES).optional(),
        nome_file: z.string().min(1).max(200),
      }),
    },
    async ({ corso_id, persona_id, tipo_persona, nome_file }) => {
      if (!corso_id && !persona_id) throw new Error('Indica almeno corso_id o persona_id')
      if (persona_id && !tipo_persona) throw new Error('Con persona_id serve tipo_persona')
      const mime = mimeForFile(nome_file)
      if (!mime) throw new Error('Tipo di file non ammesso (pdf, p7m, doc/x, xls/x, jpg, png, txt, zip)')
      const path = buildDocumentStoragePath({ personType: persona_id ? tipo_persona : null, personId: persona_id ?? null, courseId: corso_id ?? null, fileName: nome_file })
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data) throw dbError(error, 'Preparazione caricamento')
      return text({ percorso: path, url_caricamento: data.signedUrl, content_type: mime, metodo: 'PUT' })
    },
  )

  server.registerTool(
    'registra_documento',
    {
      description: 'Registra nei documenti un file già caricato con prepara_caricamento.',
      inputSchema: z.object({
        percorso: z.string().min(1),
        corso_id: z.string().uuid().optional(),
        persona_id: z.string().uuid().optional(),
        tipo_persona: z.enum(PERSON_TYPES).optional(),
        categoria: z.enum(DOCUMENT_CATEGORIES),
        titolo: z.string().min(1).max(200),
        nome_file: z.string().min(1).max(200),
      }),
    },
    async (args) => {
      const { percorso, corso_id, persona_id, tipo_persona, categoria, titolo, nome_file } = args
      const mime = mimeForFile(nome_file)
      if (!mime) throw new Error('Tipo di file non ammesso')
      const slash = percorso.lastIndexOf('/')
      const listed = await db.storage.from(BUCKET).list(percorso.slice(0, slash), { search: percorso.slice(slash + 1), limit: 1 })
      const object = listed.data?.find((o) => o.name === percorso.slice(slash + 1))
      if (listed.error || !object) throw new Error('File non trovato: caricalo prima con l’indirizzo di prepara_caricamento')
      const size = Number((object.metadata as { size?: number } | null)?.size ?? 0)
      const { data, error } = await db
        .from('documents')
        .insert({
          person_type: persona_id ? tipo_persona : null,
          person_id: persona_id ?? null,
          course_id: corso_id ?? null,
          category: categoria,
          title: titolo,
          file_name: nome_file,
          storage_path: percorso,
          mime_type: mime,
          size_bytes: size,
          uploaded_by: auth.userId,
        })
        .select('id, title, category, file_name, course_id, person_id, created_at')
        .single()
      if (error) throw dbError(error, 'Registrazione documento')
      const warning = await audit(db, { tool: 'registra_documento', courseId: corso_id, summary: `Caricato «${titolo}» (${nome_file})`, args })
      return text({ caricato: data, avviso: warning })
    },
  )

  server.registerTool(
    'collega_documento',
    {
      description: 'Collega un documento già presente a un altro corso (un decreto o un verbale può riguardare più corsi).',
      inputSchema: z.object({ documento_id: z.string().uuid(), corso_id: z.string().uuid() }),
      annotations: { idempotentHint: true },
    },
    async (args) => {
      const { error } = await db.from('document_courses').upsert({ document_id: args.documento_id, course_id: args.corso_id }, { ignoreDuplicates: true })
      if (error) throw dbError(error, 'Collegamento documento')
      const warning = await audit(db, { tool: 'collega_documento', courseId: args.corso_id, summary: `Collegato documento ${args.documento_id}`, args })
      return text({ ok: true, avviso: warning })
    },
  )
}
