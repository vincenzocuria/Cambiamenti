export interface MoodleCallError {
  exception?: string
  errorcode?: string
  message?: string
}

export function moodleRestUrl(): string {
  const base = Deno.env.get('MOODLE_URL')?.replace(/\/$/, '')
  if (!base) throw new Error('MOODLE_URL mancante')
  return `${base}/webservice/rest/server.php`
}

export function moodleToken(): string {
  const token = Deno.env.get('MOODLE_WS_TOKEN')
  if (!token) throw new Error('MOODLE_WS_TOKEN mancante')
  return token
}

export function moodleCategoryId(): number {
  const raw = Number(Deno.env.get('MOODLE_CATEGORY_ID') || '1')
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

export async function moodleCall<T>(
  wsfunction: string,
  params: Record<string, string | number>,
): Promise<T> {
  const body = new URLSearchParams()
  body.set('wstoken', moodleToken())
  body.set('wsfunction', wsfunction)
  body.set('moodlewsrestformat', 'json')
  for (const [key, value] of Object.entries(params)) {
    body.set(key, String(value))
  }
  const response = await fetch(moodleRestUrl(), { method: 'POST', body })
  const payload = (await response.json()) as T | MoodleCallError
  if (payload && typeof payload === 'object' && 'exception' in payload) {
    const error = payload as MoodleCallError
    const failure = new Error(error.message || 'Errore Moodle') as Error & { errorcode?: string }
    failure.errorcode = error.errorcode
    throw failure
  }
  return payload as T
}

export function moodleShortname(code: string, edition: string, courseId: string): string {
  const raw = [code.trim(), edition.trim()].filter(Boolean).join('-') || `cm-${courseId.slice(0, 8)}`
  return raw.replace(/\s+/g, '-').slice(0, 100)
}

export function unixTime(value: string | null): number {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0
}
