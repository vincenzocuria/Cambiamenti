import type { Person } from '../types/db'
import { mailtoUrl, whatsappUrl } from './contactLinks'
import { effectiveFadEmail, hasCompleteFadCredentials } from './fadCredentials'
import { fadLoginUrl } from './fadLogin'

export const FAD_SHARE_SUBJECT = 'Credenziali accesso FAD — Cambia-Menti Formazione'

export interface FadShare {
  text: string
  mailto: string | null
  whatsapp: string | null
}

/** Email a cui spedire: anagrafica, oppure username FAD se è un indirizzo. */
export function fadDestinationEmail(person: Pick<Person, 'email' | 'fad_email'>): string {
  const contact = person.email.trim()
  if (contact.includes('@')) return contact
  const fad = person.fad_email.trim()
  return fad.includes('@') ? fad : ''
}

export function fadCredentialsText(input: {
  greetingName: string
  username: string
  password: string
  courseName?: string
}): string {
  const lines = [
    `Ciao ${input.greetingName},`,
    '',
    'ecco le credenziali per accedere alla piattaforma FAD di Cambia-Menti Formazione.',
    '',
    `Link: ${fadLoginUrl(input.username)}`,
    `Username: ${input.username}`,
    `Password: ${input.password}`,
  ]
  const course = input.courseName?.trim()
  if (course) lines.push('', `Corso: ${course}`)
  return lines.join('\n')
}

export function formatCourseShareLabel(course: { name: string; edition?: string | null }): string {
  const edition = course.edition?.trim()
  return edition ? `${course.name} · ${edition}` : course.name
}

/** Messaggio e link di invio. Null se username o password FAD mancano. */
export function fadShareForPerson(
  person: Pick<Person, 'first_name' | 'email' | 'phone' | 'fad_email' | 'fad_password'>,
  courseName?: string,
): FadShare | null {
  if (!hasCompleteFadCredentials(person)) return null
  const username = effectiveFadEmail(person)
  const password = person.fad_password.trim()
  const greeting = person.first_name.trim() || 'ciao'
  const text = fadCredentialsText({
    greetingName: greeting,
    username,
    password,
    courseName,
  })
  const destination = fadDestinationEmail(person)
  return {
    text,
    mailto: destination ? mailtoUrl(destination, { subject: FAD_SHARE_SUBJECT, body: text }) : null,
    whatsapp: person.phone.trim() ? whatsappUrl(person.phone, text) : null,
  }
}
