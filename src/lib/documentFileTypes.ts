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
