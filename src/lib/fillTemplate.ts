/** Sostituisce `{{chiave}}` con i valori del contesto. Chiavi mancanti → stringa vuota. */
export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, key: string) => {
    return vars[key] ?? ''
  })
}
