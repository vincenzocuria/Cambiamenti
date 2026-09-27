const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FadCredentialsBody {
  audience: 'students' | 'people'
  personIds: string[]
  courseName: string
}

export function parseFadCredentialsBody(raw: unknown): FadCredentialsBody {
  if (!raw || typeof raw !== 'object') throw new Error('Body non valido')
  const o = raw as Record<string, unknown>
  const audience = o.audience === 'students' || o.audience === 'people' ? o.audience : null
  if (!audience) throw new Error('Elenco non valido')
  if (!Array.isArray(o.personIds) || o.personIds.length === 0) {
    throw new Error('Seleziona almeno una persona')
  }
  if (o.personIds.length > 80) throw new Error('Massimo 80 invii per volta')
  const personIds: string[] = []
  for (const id of o.personIds) {
    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Identificativo non valido')
    if (!personIds.includes(id)) personIds.push(id)
  }
  const courseName =
    typeof o.courseName === 'string' ? o.courseName.replace(/[\r\n]+/g, ' ').trim().slice(0, 180) : ''
  return { audience, personIds, courseName }
}
