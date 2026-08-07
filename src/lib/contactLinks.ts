/** URL mailto: se l'email è valida. */
export function mailtoUrl(email: string): string | null {
  const value = email.trim()
  if (!value || !value.includes('@')) return null
  return `mailto:${value}`
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

/** URL WhatsApp Web/Desktop: https://wa.me/39… */
export function whatsappUrl(phone: string): string | null {
  const digits = toWhatsAppDigits(phone)
  return digits ? `https://wa.me/${digits}` : null
}
