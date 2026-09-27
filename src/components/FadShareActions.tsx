import type { Person } from '../types/db'
import { fadShareForPerson } from '../lib/fadShareMessage'

type Props = {
  person: Pick<Person, 'first_name' | 'email' | 'phone' | 'fad_email' | 'fad_password'>
  courseLabel?: string
  compact?: boolean
}

const buttonClass =
  'inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50'

const compactClass = 'text-xs text-indigo-600 hover:underline'

export function FadShareActions({ person, courseLabel, compact = false }: Props) {
  const share = fadShareForPerson(person, courseLabel)
  if (!share) return null
  if (!share.mailto && !share.whatsapp) {
    if (compact) return null
    return (
      <p className="text-xs text-amber-700">
        Per inviare le credenziali serve un’email o un telefono in anagrafica.
      </p>
    )
  }

  const className = compact ? compactClass : buttonClass

  return (
    <div className={compact ? 'mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5' : 'flex flex-wrap gap-2'}>
      {share.mailto && (
        <a
          href={share.mailto}
          className={className}
          title="Apre l’email con link, username e password"
          onClick={(e) => e.stopPropagation()}
        >
          Email credenziali
        </a>
      )}
      {share.whatsapp && (
        <a
          href={share.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          title="Apre WhatsApp con link, username e password"
          onClick={(e) => e.stopPropagation()}
        >
          WhatsApp credenziali
        </a>
      )}
    </div>
  )
}
