const EMAIL_TYPES = new Set(['user_pending', 'course_to_report', 'doc_expiry'])

export interface EmailBody {
  type?: string
  title?: string
  body?: string
  link?: string
  pendingEmail?: string
}

export function parseEmailBody(raw: unknown): EmailBody {
  if (!raw || typeof raw !== 'object') throw new Error('Body non valido')
  const o = raw as Record<string, unknown>
  const type = typeof o.type === 'string' ? o.type.trim() : ''
  if (!EMAIL_TYPES.has(type)) throw new Error('Tipo notifica non valido')
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const body = typeof o.body === 'string' ? o.body.trim() : ''
  if (!title || !body) throw new Error('Titolo e testo obbligatori')
  const link = typeof o.link === 'string' ? o.link.trim() : ''
  const pendingEmail =
    typeof o.pendingEmail === 'string' ? o.pendingEmail.trim().toLowerCase() : ''
  return { type, title, body, link, pendingEmail }
}
