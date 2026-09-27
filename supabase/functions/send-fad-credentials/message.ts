/** Allineato a src/lib/fadLogin.ts e src/lib/fadShareMessage.ts */
export const FAD_LOGIN_URL = 'https://www.cambiamentisrl.it/fad/login/index.php'
export const FAD_SHARE_SUBJECT = 'Credenziali accesso FAD — Cambia-Menti Formazione'

export function destinationEmail(email: string, fadEmail: string): string {
  const contact = email.trim()
  if (contact.includes('@')) return contact
  const fad = fadEmail.trim()
  return fad.includes('@') ? fad : ''
}

export function credentialsText(input: {
  greetingName: string
  username: string
  password: string
  courseName: string
}): string {
  const lines = [
    `Ciao ${input.greetingName},`,
    '',
    'ecco le credenziali per accedere alla piattaforma FAD di Cambia-Menti Formazione.',
    '',
    `Link: ${FAD_LOGIN_URL}`,
    `Username: ${input.username}`,
    `Password: ${input.password}`,
  ]
  if (input.courseName) lines.push('', `Corso: ${input.courseName}`)
  return lines.join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function credentialsHtml(input: {
  greetingName: string
  username: string
  password: string
  courseName: string
}): string {
  const course = input.courseName
    ? `<p style="margin:16px 0 0">Corso: ${escapeHtml(input.courseName)}</p>`
    : ''
  return `
    <div style="font-family:system-ui,sans-serif;color:#1e293b;line-height:1.5">
      <p style="margin:0 0 12px">Ciao ${escapeHtml(input.greetingName)},</p>
      <p style="margin:0 0 12px">ecco le credenziali per accedere alla piattaforma FAD di Cambia-Menti Formazione.</p>
      <p style="margin:0 0 12px"><a href="${FAD_LOGIN_URL}" style="color:#4338ca">${FAD_LOGIN_URL}</a></p>
      <p style="margin:0">Username: <strong>${escapeHtml(input.username)}</strong><br>Password: <strong>${escapeHtml(input.password)}</strong></p>
      ${course}
    </div>
  `.trim()
}
