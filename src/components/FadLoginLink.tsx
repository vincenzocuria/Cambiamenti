import { useState } from 'react'
import { fadLoginUrl } from '../lib/fadLogin'

type Props = {
  username: string
  password?: string
  className?: string
  label?: string
  compact?: boolean
}

export function FadLoginLink({ username, password, className = '', label, compact = false }: Props) {
  const href = fadLoginUrl(username)
  const [hint, setHint] = useState('')

  async function copyPassword() {
    const secret = password?.trim()
    if (!secret) {
      setHint('')
      return
    }
    try {
      await navigator.clipboard.writeText(secret)
      setHint('Username già nel modulo. Password copiata: incollala nel campo.')
    } catch {
      setHint('Username già nel modulo. Copia la password dalla scheda e incollala.')
    }
  }

  return (
    <span className={compact ? undefined : 'block'}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title="Apre il login FAD con lo username già compilato"
        onClick={(e) => {
          e.stopPropagation()
          void copyPassword()
        }}
      >
        {label ?? href}
      </a>
      {!compact && hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </span>
  )
}
