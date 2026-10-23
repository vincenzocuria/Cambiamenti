/**
 * Configurazione centralizzata per sicurezza e privacy.
 * Tutte le impostazioni sensibili devono provenire da variabili d'ambiente.
 */

/**
 * Email dei superadmin autorizzati (deve essere impostato via env var).
 * Nessun fallback: se non impostato, nessuno è superadmin (fail-closed).
 */
export function getSuperAdminEmails(): string[] {
  const raw = import.meta.env.VITE_SUPERADMIN_EMAILS
  if (!raw || !raw.trim()) {
    return []
  }
  return raw
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0)
}

/**
 * Verifica se un'email appartiene a un superadmin.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return getSuperAdminEmails().includes(normalized)
}
