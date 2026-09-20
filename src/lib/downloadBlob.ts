/** Scarica un blob come file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Nome file con data locale: `personale_2026-09-20`. */
export function datedFileName(base: string, ext: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const safe = base.replace(/[^\wÀ-ÿ-]+/g, '_').replace(/^_|_$/g, '')
  return `${safe}_${y}-${m}-${day}.${ext}`
}
