export type InviteBody = {
  email: string
  fullName: string
  role: 'staff' | 'admin'
  redirectTo: string
}

export function parseInviteBody(raw: unknown): InviteBody {
  if (!raw || typeof raw !== 'object') throw new Error('Body non valido')
  const body = raw as Record<string, unknown>

  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  const fullName = String(body.fullName ?? '').trim()
  const role = body.role
  const redirectTo = String(body.redirectTo ?? '').trim()

  if (!email || !email.includes('@')) throw new Error('Email non valida')
  if (!fullName) throw new Error('Nome obbligatorio')
  if (role !== 'staff' && role !== 'admin') throw new Error('Ruolo non valido')
  if (!redirectTo.startsWith('http')) throw new Error('redirectTo non valido')

  return { email, fullName, role, redirectTo }
}
