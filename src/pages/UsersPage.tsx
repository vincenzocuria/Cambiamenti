import { useEffect, useState } from 'react'
import type { Profile, Role } from '../types/db'
import { listProfiles, setRole } from '../services/profiles'
import { useAuth } from '../hooks/useAuth'
import { fmtDate } from '../lib/format'
import { isSuperAdmin, isSuperAdminEmail } from '../lib/roles'
import { splitPendingProfiles } from '../lib/profileLists'
import { EmailLink } from '../components/ContactLinks'
import { InviteUserForm } from '../components/InviteUserForm'
import { UserRoleControls } from '../components/UserRoleControls'
import { tableClass, tdClass, thClass, theadRowClass, trClass } from '../lib/tableStyles'

function isRoleLocked(p: Profile, meId: string | undefined): boolean {
  return p.id === meId || isSuperAdmin(p.role) || isSuperAdminEmail(p.email)
}

function UsersTable({
  profiles,
  meId,
  actorRole,
  busyId,
  emptyLabel,
  onApprove,
  onChangeRole,
}: {
  profiles: Profile[]
  meId: string | undefined
  actorRole: Role | null | undefined
  busyId: string | null
  emptyLabel: string
  onApprove: (id: string) => void
  onChangeRole: (id: string, role: Role) => void
}) {
  if (profiles.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-500">{emptyLabel}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr className={theadRowClass}>
            <th className={thClass}>Email</th>
            <th className={thClass}>Nome</th>
            <th className={thClass}>Registrato il</th>
            <th className={thClass}>Ruolo</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className={trClass}>
              <td className={`${tdClass} font-medium`}>
                <EmailLink value={p.email} />
              </td>
              <td className={tdClass}>{p.full_name || '—'}</td>
              <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                {fmtDate(p.created_at)}
              </td>
              <td className={tdClass}>
                <UserRoleControls
                  profile={p}
                  actorRole={actorRole}
                  locked={isRoleLocked(p, meId)}
                  busy={busyId === p.id}
                  onApprove={onApprove}
                  onChangeRole={onChangeRole}
                />
                {p.id === meId && (
                  <span className="ml-2 text-xs text-slate-400">(tu)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Pagina admin: approvazione e gestione ruoli degli utenti
export function UsersPage() {
  const { profile: me } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    setProfiles(await listProfiles())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleRole(id: string, role: Role) {
    setError('')
    setBusyId(id)
    try {
      await setRole(id, role)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally {
      setBusyId(null)
    }
  }

  const { pending, others } = splitPendingProfiles(profiles)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Utenti</h1>
      <p className="mb-6 text-sm text-slate-500">
        Puoi invitare utenti da qui, oppure approvare chi si è registrato da solo.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <InviteUserForm actorRole={me?.role} onInvited={() => void reload()} />

      <section className="mb-8 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
        <div className="flex items-center justify-between border-b border-amber-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-amber-900">In attesa di approvazione</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {pending.length}
          </span>
        </div>
        <div className="bg-white">
          <UsersTable
            profiles={pending}
            meId={me?.id}
            actorRole={me?.role}
            busyId={busyId}
            emptyLabel="Nessuna richiesta in sospeso."
            onApprove={(id) => void handleRole(id, 'staff')}
            onChangeRole={(id, role) => void handleRole(id, role)}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Utenti abilitati</h2>
        </div>
        <UsersTable
          profiles={others}
          meId={me?.id}
          actorRole={me?.role}
          busyId={busyId}
          emptyLabel="Nessun utente abilitato."
          onApprove={(id) => void handleRole(id, 'staff')}
          onChangeRole={(id, role) => void handleRole(id, role)}
        />
      </section>
    </div>
  )
}
