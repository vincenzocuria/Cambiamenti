/**
 * Configurazione centralizzata per sicurezza e privacy nelle edge functions.
 * Tutte le impostazioni sensibili devono provenire da variabili d'ambiente.
 */

/**
 * Email dei superadmin autorizzati (deve essere impostato via env var).
 * Nessun fallback: se non impostato, nessuno è superadmin (fail-closed).
 */
export function getSuperAdminEmails(): string[] {
  const raw = Deno.env.get('SUPERADMIN_EMAILS')
  if (!raw || !raw.trim()) {
    return []
  }
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

/**
 * Verifica se un'email appartiene a un superadmin.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return getSuperAdminEmails().includes(normalized)
}

/**
 * Origini CORS consentite per le edge functions.
 * Deve essere impostato via env var, nessun fallback a wildcard.
 */
export function getAllowedCorsOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_CORS_ORIGINS')
  if (!raw || !raw.trim()) {
    return []
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
}

/**
 * Verifica se un'origine è consentita per CORS.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  const allowed = getAllowedCorsOrigins()
  if (allowed.length === 0) return false
  return allowed.includes(origin)
}

/**
 * Headers CORS per le edge functions.
 * Richiede che l'origine sia nella allowlist.
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = isOriginAllowed(requestOrigin) ? requestOrigin! : 'null'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  }
}

/**
 * Confronto constant-time per secrets (prevenzione timing attacks).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verifica il CRON_SECRET dalla richiesta.
 * Fail-closed: se il secret non è configurato, la verifica fallisce sempre.
 */
export function verifyCronSecret(headerSecret: string | null): boolean {
  const envSecret = Deno.env.get('CRON_SECRET')
  if (!envSecret || !envSecret.trim()) {
    return false
  }
  if (!headerSecret) {
    return false
  }
  return constantTimeEqual(envSecret, headerSecret)
}

/**
 * Helper per risposta JSON con CORS headers appropriati.
 */
export function jsonResponse(
  body: unknown,
  status: number,
  requestOrigin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(requestOrigin),
      'Content-Type': 'application/json',
    },
  })
}
