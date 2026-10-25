/** Finestra mostrata nel riepilogo: documenti che scadono entro questi giorni. */
export const DAYS_AHEAD = 30

/**
 * Giorni mancanti alla scadenza in cui parte il promemoria.
 * Il controllo gira ogni giorno, ma avvisa solo quando almeno un documento
 * tocca una di queste soglie: così non arriva una mail al giorno.
 */
export const REMINDER_DAYS = [30, 7, 0] as const

/** Giorni interi tra oggi e la scadenza (date YYYY-MM-DD, in UTC). */
export function daysUntil(expiry: string, today: string): number {
  const ms = Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** true se oggi almeno un documento è a una delle soglie di promemoria. */
export function shouldRemind(expiries: string[], today: string): boolean {
  return expiries.some((d) => (REMINDER_DAYS as readonly number[]).includes(daysUntil(d, today)))
}
