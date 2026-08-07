import { useState, type FormEvent } from 'react'
import type { Role } from '../types/db'
import { inviteUser, type InviteRole } from '../services/inviteUser'
import { inviteRolesBy, roleLabels } from '../lib/roles'
import { TextField } from './Field'
import { PrimaryButton } from './Buttons'

interface Props {
  actorRole: Role | null | undefined
  onInvited: () => void
}

export function InviteUserForm({ actorRole, onInvited }: Props) {
  const roles = inviteRolesBy(actorRole)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<InviteRole>('staff')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (roles.length === 0) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await inviteUser({ email, fullName, role })
      setInfo('Invito inviato: l\'utente riceverà un\'email per attivare l\'account.')
      setEmail('')
      setFullName('')
      setRole('staff')
      onInvited()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore invito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Aggiungi utente</h2>
      <p className="mb-4 text-xs text-slate-500">
        Crea un account e invia un&apos;email di invito. L&apos;utente imposta la password dal link
        e accede subito con il ruolo scelto.
      </p>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Nome e cognome"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Ruolo</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <PrimaryButton type="submit" disabled={busy} className="w-full justify-center">
            {busy ? 'Invio…' : 'Invia invito'}
          </PrimaryButton>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-3 text-sm text-emerald-600">{info}</p>}
    </section>
  )
}
