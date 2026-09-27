import { supabase } from '../lib/supabase'

export interface FadEmailSkip {
  name: string
  reason: string
}

export interface SendFadCredentialsResult {
  sent: number
  skipped: FadEmailSkip[]
}

export async function sendFadCredentialsEmails(input: {
  audience: 'students' | 'people'
  personIds: string[]
  courseName?: string
}): Promise<SendFadCredentialsResult> {
  const { data, error } = await supabase.functions.invoke('send-fad-credentials', {
    body: input,
  })
  if (error) throw new Error(await readFunctionError(error))
  const body = data as { sent?: number; skipped?: FadEmailSkip[]; error?: string } | null
  if (body?.error) throw new Error(body.error)
  return {
    sent: body?.sent ?? 0,
    skipped: body?.skipped ?? [],
  }
}

async function readFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json()
        if (body?.error) return body.error
      } catch {
        /* risposta non JSON */
      }
    }
  }
  if (error instanceof Error && error.message) return error.message
  return 'Invio email non riuscito'
}
