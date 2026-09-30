const ZIP_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
] as const

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

const ZIP_FAMILY_EXT = new Set(['zip', 'docx', 'xlsx'])

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
  if (parts.length < 2) return false
  const finalExt = parts[parts.length - 1]
  if (DIGITAL_SIGNATURE_EXT.has(finalExt)) return true
  for (let i = 1; i < parts.length - 1; i++) {
    if (DIGITAL_SIGNATURE_EXT.has(parts[i])) return true
  }
  return false
}

async function readFileHead(file: File, bytes: number): Promise<Uint8Array> {
  const size = Math.min(file.size, bytes)
  if (size <= 0) return new Uint8Array(0)
  const buf = await file.slice(0, size).arrayBuffer()
  return new Uint8Array(buf)
}

/** Cerca intestazione ZIP (anche dopo prefisso SFX). */
function containsZipMagic(head: Uint8Array): boolean {
  for (let i = 0; i <= head.length - 4; i++) {
    if (head[i] !== 0x50 || head[i + 1] !== 0x4b) continue
    const sig = head[i + 2]
    if (sig === 0x03 || sig === 0x05 || sig === 0x07) return true
  }
  return false
}

function looksLikeRarMagic(head: Uint8Array): boolean {
  return (
    head.length >= 7 &&
    head[0] === 0x52 &&
    head[1] === 0x61 &&
    head[2] === 0x72 &&
    head[3] === 0x21 &&
    head[4] === 0x1a &&
    (head[5] === 0x07 || head[5] === 0x00)
  )
}

/** PKCS#7/CAdES in DER: SEQUENCE lunga (tipica dei file .p7m), non ogni 0x30 generico. */
function looksLikePkcs7DerStrict(head: Uint8Array): boolean {
  if (head.length < 4 || head[0] !== 0x30) return false
  const len = head[1]
  return len === 0x81 || len === 0x82
}

function looksLikePkcs7Pem(head: Uint8Array): boolean {
  const text = new TextDecoder('ascii', { fatal: false }).decode(head)
  return /-----BEGIN\s+(PKCS7|CMS|SIGNED)/i.test(text)
}

async function looksLikeDigitalSignatureContainer(file: File): Promise<boolean> {
  const ext = extensionOf(file.name)
  const head = await readFileHead(file, 65536)

  if (head.length === 0) return false
  if (looksLikePkcs7Pem(head)) return true

  if (ZIP_FAMILY_EXT.has(ext) && containsZipMagic(head)) return false
  if (ext === 'rar' && looksLikeRarMagic(head)) return false

  const ascii = new TextDecoder('ascii', { fatal: false }).decode(head.slice(0, 8))

  if (ext === 'pdf') {
    if (ascii.startsWith('%PDF')) return false
    return looksLikePkcs7DerStrict(head)
  }

  if (ext === 'png' && head[0] === 0x89 && head[1] === 0x50) return false
  if ((ext === 'jpg' || ext === 'jpeg') && head[0] === 0xff && head[1] === 0xd8) return false
  if (ext === 'doc' && head[0] === 0xd0 && head[1] === 0xcf) return false

  // Altri formati ammessi: il blocco resta sul nome (.p7m nel percorso), non sul contenuto.
  if (MIME_BY_EXT[ext]) return false

  return false
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

function contentTypeForExtension(file: File, ext: string): string | null {
  if (ext === 'zip') {
    if ((ZIP_MIME_TYPES as readonly string[]).includes(file.type)) return file.type
    return 'application/zip'
  }
  return MIME_BY_EXT[ext] ?? null
}

/** Tipo inviato a Storage, ricavato dall'estensione (i browser spesso lasciano vuoto .rar e .xlsx). */
export function documentContentType(file: File): string | null {
  if (fileNameHasDigitalSignatureExtension(file.name)) return null
  return contentTypeForExtension(file, extensionOf(file.name))
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
