export interface ResendInput {
  to: string[]
  subject: string
  html: string
}

export async function sendViaResend(input: ResendInput): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY non configurata')

  const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') ?? 'no-reply@vcuria.app'
  const fromName = Deno.env.get('NOTIFICATION_FROM_NAME') ?? 'Cambia-Menti Formazione'
  const from = `${fromName} <${fromEmail}>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend: ${text}`)
  }
}

export function buildHtml(title: string, body: string, link: string, origin: string): string {
  const href = link.startsWith('http') ? link : `${origin}${link.startsWith('/') ? link : `/${link}`}`
  const linkBlock = link
    ? `<p style="margin-top:16px"><a href="${href}" style="color:#4338ca">Apri in Cambia-Menti</a></p>`
    : ''
  return `
    <div style="font-family:system-ui,sans-serif;color:#1e293b;line-height:1.5">
      <h2 style="margin:0 0 8px;font-size:18px">${title}</h2>
      <p style="margin:0">${body}</p>
      ${linkBlock}
    </div>
  `.trim()
}
