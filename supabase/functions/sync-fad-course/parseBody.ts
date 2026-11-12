export interface SyncFadBody {
  courseId: string
  /** Se presente, aggiorna su Moodle solo l'iscrizione di questo alunno. */
  studentId?: string
}

export function parseSyncFadBody(body: unknown): SyncFadBody {
  if (!body || typeof body !== 'object') throw new Error('Richiesta non valida')
  const { courseId, studentId } = body as { courseId?: unknown; studentId?: unknown }
  if (typeof courseId !== 'string' || !courseId.trim()) throw new Error('Corso mancante')
  const student = typeof studentId === 'string' && studentId.trim() ? studentId.trim() : undefined
  return { courseId: courseId.trim(), studentId: student }
}
