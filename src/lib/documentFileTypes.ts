const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
}

const DIGITAL_SIGNATURE_EXT = new Set(['p7m', 'p7s', 'p7c', 'm7m'])

export const DIGITAL_SIGNATURE_REJECT_MESSAGE =
  'File firmato digitalmente non consentito: carica il documento originale (PDF, Word, ecc.), non il file .p7m/.p7s.'

export const DOCUMENT_FILE_ACCEPT = Object.keys(MIME_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(',')

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

export function fileNameHasDigitalSignatureExtension(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.')
  return parts.slice(1).some((ext) => DIGITAL_SIGNATURE_EXT.has(ext))
}

async function readFileHead(file: File, bytes: number): Promise<Uint8Array> {
  const buf = await file.slice(0, bytes).arrayBuffer()
  return new Uint8Array(buf)
}

function looksLikePkcs7Der(head: Uint8Array): boolean {
  if (head.length < 2 || head[0] !== 0x30) return false
  const len = head[1]
  if (len < 0x80) return true
  if (len === 0x81) return head.length >= 3
  if (len === 0x82) return head.length >= 4
  return false
}

function looksLikePkcs7Pem(head: Uint8Array): boolean {
  const text = new TextDecoder('ascii', { fatal: false }).decode(head)
  return /-----BEGIN\s+(PKCS7|CMS|SIGNED)/i.test(text)
}

async function looksLikeDigitalSignatureContainer(file: File): Promise<boolean> {
  const head = await readFileHead(file, 512)
  if (head.length === 0) return false
  if (looksLikePkcs7Pem(head)) return true

  const ext = extensionOf(file.name)
  const ascii = new TextDecoder('ascii', { fatal: false }).decode(head.slice(0, 8))

  if (ext === 'pdf') {
    if (!ascii.startsWith('%PDF')) {
      return looksLikePkcs7Der(head) || head[0] === 0x30
    }
    return false
  }

  const zipMagic = head[0] === 0x50 && head[1] === 0x4b
  if (zipMagic) return false

  if (ext === 'png' && head[0] === 0x89 && head[1] === 0x50) return false
  if ((ext === 'jpg' || ext === 'jpeg') && head[0] === 0xff && head[1] === 0xd8) return false
  if (ext === 'doc' && head[0] === 0xd0 && head[1] === 0xcf) return false

  return looksLikePkcs7Der(head)
}

export async function digitalSignatureRejectionReason(file: File): Promise<string | null> {
  if (fileNameHasDigitalSignatureExtension(file.name)) {
    return `${file.name}: ${DIGITAL_SIGNATURE_REJECT_MESSAGE}`
  }
  if (await looksLikeDigitalSignatureContainer(file)) {
    return `${file.name}: ${DIGITAL_SIGNATURE_REJECT_MESSAGE}`
  }
  return null
}

/** Tipo inviato a Storage, ricavato dall'estensione (i browser spesso lasciano vuoto .rar e .xlsx). */
export function documentContentType(file: File): string | null {
  if (fileNameHasDigitalSignatureExtension(file.name)) return null
  return MIME_BY_EXT[extensionOf(file.name)] ?? null
}

export async function validateDocumentForUpload(
  file: File,
): Promise<{ contentType: string } | { error: string }> {
  const signatureError = await digitalSignatureRejectionReason(file)
  if (signatureError) return { error: signatureError }

  const contentType = documentContentType(file)
  if (!contentType) {
    return {
      error: `Formato non consentito: ${file.name}. Usa PDF, Word, Excel, ZIP, RAR, immagini o testo.`,
    }
  }
  return { contentType }
}

/** Storage-js invia il MIME del File nel multipart, non l'opzione contentType. */
export function fileForDocumentUpload(file: File, contentType: string): File {
  if (file.type === contentType) return file
  return new File([file], file.name, { type: contentType, lastModified: file.lastModified })
}

export function formatDocumentUploadError(err: unknown, fileName: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Errore durante il caricamento'

  const lower = raw.toLowerCase()
  if (lower.includes('mime type') && lower.includes('not supported')) {
    return `${fileName}: formato file non consentito dallo storage.`
  }
  if (lower.includes('exceeded the maximum') || lower.includes('payload too large')) {
    return `${fileName}: file troppo grande (massimo 50 MB).`
  }
  if (lower.includes('formato non consentito') || lower.includes('firmato digitalmente')) {
    return raw
  }
  return `${fileName}: ${raw}`
}
