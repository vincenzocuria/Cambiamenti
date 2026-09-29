/** Presente se i minuti coprono almeno metà della lezione. */
export function isPresent(minutes: number, startsAt: string, endsAt: string): boolean {
  const durationMin = (Date.parse(endsAt) - Date.parse(startsAt)) / 60000
  if (!Number.isFinite(durationMin) || durationMin <= 0) return minutes > 0
  return minutes + 0.001 >= durationMin / 2
}
