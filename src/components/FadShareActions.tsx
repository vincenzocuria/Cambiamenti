import type { Person } from '../types/db'
import { effectiveFadEmail } from '../lib/fadCredentials'
import { fadShareForPerson } from '../lib/fadShareMessage'
import { FadLoginLink } from './FadLoginLink'

type Props = {
  person: Pick<Person, 'first_name' | 'email' | 'phone' | 'fad_email' | 'fad_password'>
  courseLabel?: string
  compact?: boolean
  /** Se false, mostra solo «Apri FAD» (invio credenziali altrove, es. pannello in massa). */
  shareChannels?: boolean
}

const buttonClass =
  'inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50'

const compactClass = 'text-xs text-indigo-600 hover:underline'

export function FadShareActions({
  person,
  courseLabel,
  compact = false,
  shareChannels = true,
}: Props) {
  const share = fadShareForPerson(person, courseLabel)
  const username = effectiveFadEmail(person)
  if (!share && !username) return null
  if (!share || !shareChannels) {
    return (
      <FadLoginLink
        username={username}
        password={person.fad_password}
        compact={compact}
        label="Apri FAD"
        className={compact ? compactClass : buttonClass}
      />
    )
  }
  const className = compact ? compactClass : buttonClass
  const noContact = !share.mailto && !share.whatsapp

  return (
    <div className={compact ? 'mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5' : 'space-y-2'}>
      <div className={compact ? 'contents' : 'flex flex-wrap gap-2'}>
      {username ? (
        <FadLoginLink
          username={username}
          password={person.fad_password}
          compact
          label="Apri FAD"
          className={className}
        />
      ) : null}
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
      {!compact && noContact && (
        <p className="text-xs text-amber-700">
          Per inviare le credenziali serve un’email o un telefono in anagrafica.
        </p>
      )}
    </div>
  )
}
