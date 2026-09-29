export interface SyncFadBody {
  courseId: string
}

export function parseSyncFadBody(body: unknown): SyncFadBody {
  if (!body || typeof body !== 'object') throw new Error('Richiesta non valida')
  const courseId = (body as { courseId?: unknown }).courseId
  if (typeof courseId !== 'string' || !courseId.trim()) throw new Error('Corso mancante')
  return { courseId: courseId.trim() }
}
