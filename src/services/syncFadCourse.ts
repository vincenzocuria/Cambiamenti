import { supabase } from '../lib/supabase'

export interface FadSyncSkip {
  name: string
  reason: string
}

export interface FadSyncResult {
  moodleCourseId: number
  bbbInstanceId: number | null
  enrolled: number
  createdUsers: number
  events: number
  attendance: number
  skipped: FadSyncSkip[]
  warning: string
}

export async function syncFadCourse(courseId: string): Promise<FadSyncResult> {
  const { data, error } = await supabase.functions.invoke('sync-fad-course', {
    body: { courseId },
  })
  if (error) throw new Error(await readFunctionError(error))
  const body = data as (FadSyncResult & { error?: string }) | null
  if (body?.error) throw new Error(body.error)
  if (!body?.moodleCourseId) throw new Error('Risposta FAD non valida')
  return body
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
  return 'Sincronizzazione FAD non riuscita'
}
