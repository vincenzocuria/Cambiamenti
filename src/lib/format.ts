export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleDateString('it-IT')
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function fullName(p: { first_name: string; last_name: string }): string {
  return `${p.last_name} ${p.first_name}`.trim()
}
