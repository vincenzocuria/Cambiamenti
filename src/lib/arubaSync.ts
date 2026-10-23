/** Regole della sincronizzazione Aruba dal gestionale (servizio sul PC). */

/** Anni da sincronizzare quando la richiesta non li indica: l'anno in corso, e a inizio anno anche il precedente. */
export function defaultYears(now = new Date()): number[] {
  const year = now.getFullYear()
  return now.getMonth() < 2 ? [year - 1, year] : [year]
}

/** Va fatta la sincronizzazione automatica? Sì se l'ultima finita è più vecchia dell'intervallo. */
export function autoSyncDue(lastFinishedAt: string | null, everyHours: number, now = Date.now()): boolean {
  if (everyHours <= 0) return false
  if (!lastFinishedAt) return true
  return now - new Date(lastFinishedAt).getTime() >= everyHours * 3_600_000
}

/** Il servizio è acceso se ha dato segnale negli ultimi 2 minuti (lo dà ogni 30 secondi). */
export function agentOnline(agent: { last_seen_at: string } | null, now = Date.now()): boolean {
  return !!agent && now - new Date(agent.last_seen_at).getTime() < 120_000
}
