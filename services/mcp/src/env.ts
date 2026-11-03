/** Binding e variabili del Worker MCP (vedi wrangler.jsonc). */
export interface Env {
  /** D1: client OAuth, codici e concessioni del connettore. */
  DB: D1Database
  /** URL del progetto Supabase del gestionale. */
  SUPABASE_URL: string
  /** Chiave publishable (pubblica, la stessa del sito): i dati restano protetti da RLS. */
  SUPABASE_PUBLISHABLE_KEY: string
  /** Segreto (wrangler secret): chiave AES-256 in base64 per cifrare i token Supabase salvati in D1. */
  CAMBIAMENTI_MCP_TOKEN_KEY: string
  /** Origine pubblica del connettore, es. https://mcp.cambiamenti.vcuria.app */
  APP_ORIGIN?: string
}
