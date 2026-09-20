import { useState, type FormEvent } from 'react'
import type { Profile } from '../types/db'
import { canResetUserPassword } from '../lib/canResetUserPassword'
import { passwordError } from '../lib/passwordRules'
import { resetUserPassword } from '../services/resetUserPassword'
import { PasswordField } from './PasswordField'
import { SecondaryButton } from './Buttons'

interface Props {
  target: Profile
  actor: Pick<Profile, 'role' | 'email'> | null | undefined
  busy: boolean
  onBusy: (busy: boolean) => void
  onError: (message: string) => void
  onInfo: (message: string) => void
}

export function ResetUserPassword({ target, actor, busy, onBusy, onError, onInfo }: Props) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  if (!canResetUserPassword(actor, target)) return null

  async function sendEmail() {
    onBusy(true)
    onError('')
    onInfo('')
    try {
      await resetUserPassword({ userId: target.id, mode: 'email' })
      onInfo(`Email di reset inviata a ${target.email}.`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Invio email non riuscito')
    } finally {
      onBusy(false)
    }
  }

  async function setDirect(e: FormEvent) {
    e.preventDefault()
    const issue = passwordError(password, confirm)
    if (issue) {
      onError(issue)
      return
    }
    onBusy(true)
    onError('')
    onInfo('')
    try {
      await resetUserPassword({ userId: target.id, mode: 'direct', password })
      onInfo(`Password aggiornata per ${target.email}.`)
      setPassword('')
      setConfirm('')
      setOpen(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Impostazione password non riuscita')
    } finally {
      onBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <SecondaryButton
          type="button"
          disabled={busy}
          className="!px-2.5 !py-1 !text-xs"
          onClick={() => void sendEmail()}
        >
          Invia email
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={busy}
          className="!px-2.5 !py-1 !text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Chiudi' : 'Imposta'}
        </SecondaryButton>
      </div>
      {open && (
        <form onSubmit={(e) => void setDirect(e)} className="max-w-xs space-y-2">
          <PasswordField
            label="Nuova password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordField
            label="Conferma"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <SecondaryButton type="submit" disabled={busy} className="!px-2.5 !py-1 !text-xs">
            Salva password
          </SecondaryButton>
        </form>
      )}
    </div>
  )
}
