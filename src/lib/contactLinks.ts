/** URL mailto: se l'email è valida. Oggetto e testo sono opzionali. */
export function mailtoUrl(
  email: string,
  extra?: { subject?: string; body?: string },
): string | null {
  const value = email.trim()
  if (!value || !value.includes('@')) return null
  const params = new URLSearchParams()
  if (extra?.subject) params.set('subject', extra.subject)
  if (extra?.body) params.set('body', extra.body)
  const query = params.toString()
  return query ? `mailto:${value}?${query}` : `mailto:${value}`
}

/**
 * Cifre internazionali per wa.me (WhatsApp Web / Desktop / app).
 * Es. "+39 379 329 8942" → "393793298942"
 */
export function toWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.startsWith('39') && digits.length >= 11) return digits

  // Cellulare IT: 3xx… (10 cifre) oppure 03xx…
  if (digits.startsWith('3') && digits.length === 10) return `39${digits}`
  if (digits.startsWith('03') && digits.length === 11) return `39${digits.slice(1)}`

  // Fisso IT con 0 iniziale
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 11) {
    return `39${digits.slice(1)}`
  }

  return digits
}

/** URL WhatsApp Web/Desktop: https://wa.me/39… Il testo precompila la chat. */
export function whatsappUrl(phone: string, text?: string): string | null {
  const digits = toWhatsAppDigits(phone)
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  const message = text?.trim()
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
