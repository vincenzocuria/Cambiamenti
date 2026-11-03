// Registro modifiche (tabella public.mcp_audit_log, migrazione 0029).

import type { SupabaseClient } from '@supabase/supabase-js'

export async function audit(
  db: SupabaseClient,
  entry: { tool: string; courseId?: string | null; summary: string; args: Record<string, unknown> },
): Promise<string | null> {
  const { error } = await db.from('mcp_audit_log').insert({
    tool: entry.tool,
    course_id: entry.courseId ?? null,
    summary: entry.summary.slice(0, 2000),
    args: redact(entry.args),
  })
  return error ? `Attenzione: modifica fatta ma non registrata nel registro (${error.message})` : null
}

/** Il contenuto dei file non va nel registro: resta solo la dimensione. */
function redact(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    out[k] = k === 'contenuto_base64' && typeof v === 'string' ? `[${Math.round((v.length * 3) / 4)} byte]` : v
  }
  return out
}
