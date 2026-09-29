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

export const DOCUMENT_FILE_ACCEPT = Object.keys(MIME_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(',')

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

/** Tipo inviato a Storage, ricavato dall'estensione (i browser spesso lasciano vuoto .rar e .xlsx). */
export function documentContentType(file: File): string | null {
  return MIME_BY_EXT[extensionOf(file.name)] ?? null
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
