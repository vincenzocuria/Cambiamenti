/**
 * Sostituisce `{{chiave}}` con i valori del contesto. Chiavi mancanti → stringa vuota.
 * `{{chiave|____}}`: se il valore manca o è vuoto scrive il testo dopo `|` (righe da compilare a mano).
 */
export const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g

export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(PLACEHOLDER_RE, (_match, key: string, fallback?: string) => {
    const value = vars[key]
    if (fallback !== undefined && !value?.trim()) return fallback
    return value ?? ''
  })
}
