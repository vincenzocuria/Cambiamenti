import { mailtoUrl, whatsappUrl } from '../lib/contactLinks'

const linkClass =
  'text-indigo-600 hover:underline focus:outline-none focus:underline'

type Props = {
  value: string
  className?: string
  empty?: string
}

/** Apre il client di posta predefinito. */
export function EmailLink({ value, className = '', empty = '—' }: Props) {
  const href = mailtoUrl(value)
  if (!href) {
    return <span className={className}>{value.trim() || empty}</span>
  }
  return (
    <a
      href={href}
      className={`${linkClass} ${className}`}
      title={`Invia email a ${value.trim()}`}
      onClick={(e) => e.stopPropagation()}
    >
      {value.trim()}
    </a>
  )
}

/** Apre WhatsApp Web / Desktop / app sul numero. */
export function WhatsAppLink({ value, className = '', empty = '—' }: Props) {
  const href = whatsappUrl(value)
  if (!href) {
    return <span className={className}>{value.trim() || empty}</span>
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} ${className}`}
      title={`Apri WhatsApp: ${value.trim()}`}
      onClick={(e) => e.stopPropagation()}
    >
      {value.trim()}
    </a>
  )
}
