// Worker del connettore MCP: OAuth (/oauth/*, /.well-known/*) e endpoint /mcp.

import { createMcpHandler } from 'agents/mcp/server'
import { authenticateBearer, UnauthorizedError } from './auth/session'
import type { Env } from './env'
import { corsHeaders, json } from './lib/http'
import { createGestionaleMcp } from './mcp/server'
import { handleOAuth, mcpWwwAuthenticate } from './oauth/oauth'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    try {
      const oauth = await handleOAuth(request, env)
      if (oauth) return oauth

      if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
        const auth = await authenticateBearer(env, request.headers.get('authorization'))
        const handler = createMcpHandler(() => createGestionaleMcp(env, auth), { route: '/mcp' })
        return handler(request, env, ctx)
      }

      if (url.pathname === '/' || url.pathname === '/health') {
        return json({ ok: true, name: 'Connettore MCP gestionale Cambia-Menti', mcp: `${url.origin}/mcp` })
      }
      return json({ error: 'not_found' }, 404)
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return json({ error: 'invalid_token', error_description: error.message }, 401, {
          'WWW-Authenticate': mcpWwwAuthenticate(env, request),
        })
      }
      console.error('Errore connettore MCP', error instanceof Error ? error.message : 'sconosciuto')
      return json({ error: 'server_error', error_description: 'Errore interno' }, 500)
    }
  },
}
