/**
 * Lettura di una PEC grezza: busta di Aruba (postacert.eml), oggetto pulito, testo e allegati.
 * Funzioni pure (nessun accesso alla casella), provate in src/__tests__/pecExtract.test.ts.
 */
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser'
import { isSignedFileName, unsignedFileName, unwrapP7m } from '../../src/lib/p7m'
import { linesFromItems } from '../../src/lib/pdfText'

export interface PecAttachment {
  fileName: string
  mimeType: string
  content: Uint8Array
  /** Testo estratto (PDF, anche dentro .p7m; file di testo). */
  text: string
}

export interface ParsedPec {
  subject: string
  from: string
  to: string
  sentAt: string | null
  messageId: string | null
  text: string
  attachments: PecAttachment[]
  /** Ricevute di accettazione/consegna e simili: non servono a Claude. */
  isReceipt: boolean
}

/** File della busta PEC che non sono documenti. */
const ENVELOPE_FILES = new Set(['daticert.xml', 'smime.p7s', 'postacert.eml'])

const RECEIPT_PREFIX = /^(ACCETTAZIONE|CONSEGNA|AVVISO DI NON ACCETTAZIONE|AVVISO DI MANCATA CONSEGNA|PREAVVISO DI MANCATA CONSEGNA|PRESA IN CARICO|ERRORE DI CONSEGNA|RILEVAZIONE VIRUS)\s*:/i

export function isReceiptSubject(subject: string): boolean {
  return RECEIPT_PREFIX.test(subject.trim())
}

/** «POSTA CERTIFICATA: oggetto» → «oggetto». */
export function cleanSubject(subject: string): string {
  return subject.replace(/^\s*POSTA CERTIFICATA\s*:\s*/i, '').replace(/\s+/g, ' ').trim()
}

function addresses(a: AddressObject | AddressObject[] | undefined): string {
  const list = Array.isArray(a) ? a : a ? [a] : []
  return list
    .flatMap((x) => x.value)
    .map((v) => v.address ?? v.name ?? '')
    .filter(Boolean)
    .join(', ')
}

const MAX_TEXT = 100_000

export async function pdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true })
    const doc = await task.promise
    const lines: string[] = []
    try {
      for (let p = 1; p <= doc.numPages && lines.join('\n').length < MAX_TEXT; p++) {
        const page = await doc.getPage(p)
        const content = await page.getTextContent()
        lines.push(...linesFromItems(content.items.flatMap((i) => ('str' in i ? [i] : []))))
      }
    } finally {
      void task.destroy()
    }
    return lines.join('\n').slice(0, MAX_TEXT)
  } catch {
    return ''
  }
}

async function attachmentText(fileName: string, mime: string, content: Uint8Array): Promise<string> {
  let name = fileName
  let bytes = content
  if (isSignedFileName(name)) {
    const inner = unwrapP7m(bytes)
    if (!inner) return ''
    bytes = inner
    name = unsignedFileName(name)
  }
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return pdfText(bytes)
  if (lower.endsWith('.txt') || mime.startsWith('text/plain')) return new TextDecoder().decode(bytes).slice(0, MAX_TEXT)
  return ''
}

function bodyText(mail: ParsedMail): string {
  const text = mail.text?.trim() || (typeof mail.html === 'string' ? mail.html.replace(/<[^>]+>/g, ' ') : '')
  return text.replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT)
}

export async function parsePec(raw: Buffer | Uint8Array): Promise<ParsedPec> {
  const outer = await simpleParser(Buffer.from(raw))
  const outerSubject = outer.subject ?? ''
  // Le PEC ricevute contengono il messaggio originale come allegato postacert.eml
  const envelope = outer.attachments.find((a) => a.filename?.toLowerCase() === 'postacert.eml' || a.contentType === 'message/rfc822')
  const inner = envelope ? await simpleParser(envelope.content) : null
  const mail = inner ?? outer

  const attachments: PecAttachment[] = []
  for (const a of mail.attachments) {
    const fileName = (a.filename ?? '').trim()
    if (!fileName || ENVELOPE_FILES.has(fileName.toLowerCase())) continue
    if (a.contentDisposition === 'inline' && a.contentType.startsWith('image/')) continue
    const content = new Uint8Array(a.content)
    attachments.push({ fileName, mimeType: a.contentType, content, text: await attachmentText(fileName, a.contentType, content) })
  }

  return {
    subject: cleanSubject(inner?.subject || outerSubject),
    from: addresses(mail.from) || addresses(outer.from),
    to: addresses(mail.to) || addresses(outer.to),
    sentAt: (mail.date ?? outer.date)?.toISOString() ?? null,
    messageId: mail.messageId ?? outer.messageId ?? null,
    text: bodyText(mail),
    attachments,
    isReceipt: isReceiptSubject(outerSubject),
  }
}

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
  rar: 'application/vnd.rar',
}

/** Tipo ammesso dal bucket documents (altrimenti octet-stream, anch'esso ammesso). */
export function storageMime(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150) || 'allegato'
}
