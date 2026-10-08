import { getCorsHeaders } from '../_shared/securityConfig.ts'

/**
 * @deprecated Use getCorsHeaders() from securityConfig instead
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * @deprecated Use jsonResponse from securityConfig with requestOrigin parameter
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function getCorsHeadersForRequest(req: Request): Record<string, string> {
  return getCorsHeaders(req.headers.get('origin'))
}
