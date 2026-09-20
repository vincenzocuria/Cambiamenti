/** Confronta un testo concatenato con la query di ricerca (case-insensitive). */
export function matchesSearch(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystack.toLowerCase().includes(q)
}
