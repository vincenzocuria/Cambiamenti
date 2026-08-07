import { useEffect, useState } from 'react'
import type { Profile, Role } from '../types/db'
import { listProfiles, setRole } from '../services/profiles'
import { useAuth } from '../hooks/useAuth'
import { fmtDate } from '../lib/format'
import {
  assignableRoles,
  isSuperAdmin,
  isSuperAdminEmail,
  roleLabels,
} from '../lib/roles'

// Pagina admin: approvazione e gestione ruoli degli utenti
export function UsersPage() {
  const { profile: me } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState('')

  async function reload() {
    setProfiles(await listProfiles())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleRole(id: string, role: Role) {
    setError('')
    try {
      await setRole(id, role)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Utenti</h1>
      <p className="mb-6 text-sm text-slate-500">
        I nuovi utenti restano "In attesa" e non vedono alcun dato finché non li abiliti come Staff.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-3">Email</th>
              <th>Nome</th>
              <th>Registrato il</th>
              <th>Ruolo</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const locked =
                p.id === me?.id || isSuperAdmin(p.role) || isSuperAdminEmail(p.email)

              return (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{p.email}</td>
                  <td>{p.full_name || '—'}</td>
                  <td>{fmtDate(p.created_at)}</td>
                  <td>
                    {locked ? (
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                        {roleLabels[p.role]}
                        {p.id === me?.id ? ' (tu)' : ''}
                      </span>
                    ) : (
                      <select
                        value={p.role === 'admin' ? 'staff' : p.role}
                        onChange={(e) => void handleRole(p.id, e.target.value as Role)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                      >
                        {assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
