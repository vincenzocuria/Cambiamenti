/** Brand email Cambia-Menti Formazione (solo script deploy). */
export const emailBrand = {
  name: 'Cambia-Menti Formazione',
  shortName: 'Cambia-Menti',
  siteUrl: 'https://cambiamenti.vcuria.app',
  logoUrl: 'https://cambiamenti.vcuria.app/logo-cambia-menti.png',
  supportEmail: 'cambiamenticalabria@gmail.com',
  phone: '+39 379 329 8942',
  address: 'C.da Cardame snc, Corigliano-Rossano',
  vatNumber: '03936190788',
  colors: {
    bg: '#f0f7fa',
    card: '#ffffff',
    text: '#1a2f38',
    muted: '#5a7380',
    border: '#d7e6ec',
    accent: '#0096c7',
    accentSoft: '#e8f6fb',
    buttonText: '#ffffff',
  },
}

/**
 * Layout HTML email brandizzato.
 * @param {{ title: string, bodyHtml: string, footerNote?: string }} opts
 */
export function wrapAuthEmailHtml({ title, bodyHtml, footerNote }) {
  const { name, shortName, siteUrl, logoUrl, supportEmail, phone, address, colors } = emailBrand
  const year = new Date().getFullYear()
  const note =
    footerNote ||
    'Se non hai richiesto questa email, puoi ignorarla in sicurezza.'

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${colors.bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${colors.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${colors.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${colors.card};border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(26,47,56,0.08);">
          <tr>
            <td style="padding:28px 32px 12px;text-align:center;background:linear-gradient(180deg,${colors.accentSoft} 0%,${colors.card} 100%);">
              <img src="${logoUrl}" alt="${escapeHtml(name)}" width="160" style="display:block;margin:0 auto 16px;max-width:160px;height:auto;" />
              <h1 style="margin:0;font-size:22px;line-height:1.35;color:${colors.accent};">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;font-size:16px;line-height:1.6;">
              ${bodyHtml}
              <p style="margin:0 0 16px;font-size:14px;color:${colors.muted};">${escapeHtml(note)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${colors.border};font-size:12px;line-height:1.55;color:${colors.muted};text-align:center;">
              <p style="margin:0 0 6px;font-weight:600;color:${colors.text};">${escapeHtml(name)}</p>
              <p style="margin:0 0 6px;">${escapeHtml(address)}</p>
              <p style="margin:0 0 6px;">P.IVA ${escapeHtml(emailBrand.vatNumber)} · <a href="mailto:${supportEmail}" style="color:${colors.accent};text-decoration:none;">${escapeHtml(supportEmail)}</a> · ${escapeHtml(phone)}</p>
              <p style="margin:0;"><a href="${siteUrl}" style="color:${colors.accent};text-decoration:none;">${escapeHtml(siteUrl)}</a></p>
              <p style="margin:10px 0 0;">&copy; ${year} ${escapeHtml(shortName)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function ctaButton(label, hrefExpr) {
  const { colors } = emailBrand
  return `<p style="margin:0 0 28px;text-align:center;">
  <a href="${hrefExpr}" style="display:inline-block;background:${colors.accent};color:${colors.buttonText};text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;">${escapeHtml(label)}</a>
</p>`
}

export function greetingHtml() {
  return `<p style="margin:0 0 16px;">{{ if .Data.full_name }}Ciao {{ .Data.full_name }},{{ else }}Ciao,{{ end }}</p>`
}

export function p(text) {
  return `<p style="margin:0 0 24px;">${text}</p>`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
