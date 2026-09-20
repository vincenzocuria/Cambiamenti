export type ResetBody = {
  userId: string
  mode: 'email' | 'direct'
  password: string
  redirectTo: string
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseResetBody(raw: unknown): ResetBody {
  if (!raw || typeof raw !== 'object') throw new Error('Body non valido')
  const body = raw as Record<string, unknown>
  const userId = String(body.userId ?? '').trim()
  const mode = body.mode
  const password = String(body.password ?? '')
  const redirectTo = String(body.redirectTo ?? '').trim()

  if (!uuidRe.test(userId)) throw new Error('Utente non valido')
  if (mode !== 'email' && mode !== 'direct') throw new Error('Modalità non valida')
  if (mode === 'direct' && password.length < 8) {
    throw new Error('La password deve avere almeno 8 caratteri.')
  }
  if (mode === 'email' && !redirectTo.startsWith('http')) {
    throw new Error('redirectTo non valido')
  }

  return { userId, mode, password, redirectTo }
}
