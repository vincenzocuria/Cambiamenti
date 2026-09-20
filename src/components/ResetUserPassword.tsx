import { useState, type FormEvent } from 'react'
import type { Profile } from '../types/db'
import { canResetUserPassword } from '../lib/canResetUserPassword'
import { passwordError } from '../lib/passwordRules'
import { resetUserPassword } from '../services/resetUserPassword'
import { Modal } from './Modal'
import { PasswordField } from './PasswordField'
import { PrimaryButton, SecondaryButton } from './Buttons'

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
  const [localError, setLocalError] = useState('')

  if (!canResetUserPassword(actor, target)) return null

  const who = target.full_name ? `${target.full_name} (${target.email})` : target.email

  function close() {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setLocalError('')
  }

  async function sendEmail() {
    onBusy(true)
    setLocalError('')
    onError('')
    onInfo('')
    try {
      await resetUserPassword({ userId: target.id, mode: 'email' })
      onInfo(`Email di reset inviata a ${target.email}.`)
      close()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Invio email non riuscito')
    } finally {
      onBusy(false)
    }
  }

  async function setDirect(e: FormEvent) {
    e.preventDefault()
    const issue = passwordError(password, confirm)
    if (issue) {
      setLocalError(issue)
      return
    }
    onBusy(true)
    setLocalError('')
    onError('')
    onInfo('')
    try {
      await resetUserPassword({ userId: target.id, mode: 'direct', password })
      onInfo(`Password aggiornata per ${target.email}.`)
      close()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Impostazione password non riuscita')
    } finally {
      onBusy(false)
    }
  }

  return (
    <>
      <SecondaryButton
        type="button"
        disabled={busy}
        className="!px-2.5 !py-1 !text-xs"
        onClick={() => setOpen(true)}
      >
        Reset password
      </SecondaryButton>

      {open && (
        <Modal title="Reset password" onClose={close}>
          <p className="mb-4 text-sm text-slate-600">
            Reimposta l&apos;accesso di <span className="font-medium text-slate-800">{who}</span>.
            Scegli come procedere.
          </p>

          <section className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Invia link via email</h3>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              L&apos;utente riceve un&apos;email e imposta da solo una nuova password dal link.
            </p>
            <SecondaryButton type="button" disabled={busy} onClick={() => void sendEmail()}>
              {busy ? 'Invio…' : 'Invia email di reset'}
            </SecondaryButton>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Imposta tu la nuova password</h3>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              La password cambia subito. Comunicala all&apos;utente in modo sicuro.
            </p>
            <form onSubmit={(e) => void setDirect(e)} className="space-y-3">
              <PasswordField
                label="Nuova password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordField
                label="Conferma password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? 'Salvataggio…' : 'Salva nuova password'}
              </PrimaryButton>
            </form>
          </section>

          {localError && <p className="mt-3 text-sm text-red-600">{localError}</p>}
        </Modal>
      )}
    </>
  )
}
