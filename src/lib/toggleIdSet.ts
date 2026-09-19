export function toggleId(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function allIds(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id))
}
