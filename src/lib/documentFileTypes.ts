const ZIP_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
] as const

const PKCS7_MIME_BY_EXT: Record<string, readonly string[]> = {
  p7m: ['application/pkcs7-mime', 'application/x-pkcs7-mime', 'application/octet-stream'],
  p7c: ['application/pkcs7-mime', 'application/x-pkcs7-mime', 'application/octet-stream'],
  m7m: ['application/pkcs7-mime', 'application/x-pkcs7-mime', 'application/octet-stream'],
  p7s: ['application/pkcs7-signature', 'application/x-pkcs7-signature', 'application/octet-stream'],
}

const DEFAULT_PKCS7_MIME: Record<string, string> = {
  p7m: 'application/pkcs7-mime',
  p7c: 'application/pkcs7-mime',
  m7m: 'application/pkcs7-mime',
  p7s: 'application/pkcs7-signature',
}

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
  ...DEFAULT_PKCS7_MIME,
}

export const DOCUMENT_FILE_ACCEPT = Object.keys(MIME_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(',')

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

function contentTypeForExtension(file: File, ext: string): string | null {
  const pkcs7Allowed = PKCS7_MIME_BY_EXT[ext]
  if (pkcs7Allowed) {
    if (pkcs7Allowed.includes(file.type)) return file.type
    return DEFAULT_PKCS7_MIME[ext] ?? 'application/pkcs7-mime'
  }
  if (ext === 'zip') {
    if ((ZIP_MIME_TYPES as readonly string[]).includes(file.type)) return file.type
    return 'application/zip'
  }
  return MIME_BY_EXT[ext] ?? null
}

/** Tipo inviato a Storage, ricavato dall'estensione (i browser spesso lasciano vuoto .rar e .xlsx). */
export function documentContentType(file: File): string | null {
  return contentTypeForExtension(file, extensionOf(file.name))
}

export async function validateDocumentForUpload(
  file: File,
): Promise<{ contentType: string } | { error: string }> {
  const contentType = documentContentType(file)
  if (!contentType) {
    return {
      error: `Formato non consentito: ${file.name}. Usa PDF, Word, Excel, ZIP, RAR, file firmati (.p7m), immagini o testo.`,
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
  if (lower.includes('formato non consentito')) {
    return raw
  }
  return `${fileName}: ${raw}`
}
