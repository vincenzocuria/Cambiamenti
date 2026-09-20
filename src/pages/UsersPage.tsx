import { useEffect, useMemo, useState } from 'react'
import type { Profile, Role } from '../types/db'
import { listProfiles, setRole } from '../services/profiles'
import { useAuth } from '../hooks/useAuth'
import { useListQuery } from '../hooks/useListQuery'
import { usePagedSlice } from '../hooks/usePagedSlice'
import { fmtDate } from '../lib/format'
import { isSuperAdmin, isSuperAdminEmail, roleLabels } from '../lib/roles'
import { visibleToViewer } from '../lib/profileVisibility'
import { matchesSearch } from '../lib/matchesSearch'
import { describeFilters, exportFilteredList } from '../lib/listExport'
import { EmailLink } from '../components/ContactLinks'
import { InviteUserForm } from '../components/InviteUserForm'
import { UserRoleControls } from '../components/UserRoleControls'
import { ResetUserPassword } from '../components/ResetUserPassword'
import { KpiCards } from '../components/KpiCards'
import { ListToolbar } from '../components/ListToolbar'
import { ListPagination } from '../components/ListPagination'
import { tableClass, tdClass, thClass, theadRowClass, trClass } from '../lib/tableStyles'

function isRoleLocked(p: Profile, meId: string | undefined): boolean {
  return p.id === meId || isSuperAdmin(p.role) || isSuperAdminEmail(p.email)
}

function matchesUserStatus(p: Profile, status: string): boolean {
  if (!status) return true
  if (status === 'pending') return p.role === 'pending'
  if (status === 'abilitati') return p.role !== 'pending'
  if (status === 'amministratori') return p.role === 'admin' || p.role === 'superadmin'
  if (status === 'staff') return p.role === 'staff'
  return true
}

export function UsersPage() {
  const { profile: me } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { search, status, setSearch, setStatus } = useListQuery()

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

  const visible = useMemo(() => visibleToViewer(profiles, me), [profiles, me])

  const searched = useMemo(
    () =>
      visible.filter((p) =>
        matchesSearch(`${p.email} ${p.full_name} ${roleLabels[p.role]}`, search),
      ),
    [visible, search],
  )

  const filtered = useMemo(
    () => searched.filter((p) => matchesUserStatus(p, status)),
    [searched, status],
  )

  const { page, setPage, pages, slice, pageSize } = usePagedSlice(
    filtered,
    `${search}|${status}`,
  )
  const pending = visible.filter((p) => p.role === 'pending').length
  const admins = visible.filter((p) => p.role === 'admin' || p.role === 'superadmin').length
  const staff = visible.filter((p) => p.role === 'staff').length

  const statusLabel =
    status === 'pending'
      ? 'In attesa'
      : status === 'abilitati'
        ? 'Abilitati'
        : status === 'amministratori'
          ? 'Amministratori'
          : status === 'staff'
            ? 'Staff'
            : ''

  function toggleStatus(key: string) {
    setStatus(status === key ? '' : key)
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: 'Utenti',
      rows: filtered,
      format,
      filters: describeFilters([statusLabel, search && `ricerca «${search}»`]),
      columns: [
        { header: 'Email', value: (p) => p.email },
        { header: 'Nome', value: (p) => p.full_name || '' },
        { header: 'Registrato il', value: (p) => fmtDate(p.created_at) },
        { header: 'Ruolo', value: (p) => roleLabels[p.role] },
      ],
    })
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Utenti</h1>
      <p className="mb-6 text-sm text-slate-500">
        Puoi invitare utenti da qui, oppure approvare chi si è registrato da solo.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {info && <p className="mb-4 text-sm text-emerald-600">{info}</p>}

      <InviteUserForm actorRole={me?.role} onInvited={() => void reload()} />

      <KpiCards
        items={[
          {
            key: 'totale',
            label: 'Totale utenti',
            hint: 'Tutti i profili',
            value: visible.length,
            active: !status,
            onClick: () => setStatus(''),
          },
          {
            key: 'pending',
            label: 'In attesa',
            hint: 'Da approvare',
            value: pending,
            tone: pending > 0 ? 'warn' : 'ok',
            active: status === 'pending',
            onClick: () => toggleStatus('pending'),
          },
          {
            key: 'staff',
            label: 'Staff',
            hint: 'Accesso operativo',
            value: staff,
            tone: 'ok',
            active: status === 'staff',
            onClick: () => toggleStatus('staff'),
          },
          {
            key: 'amministratori',
            label: 'Amministratori',
            hint: 'Ruolo amministratore',
            value: admins,
            active: status === 'amministratori',
            onClick: () => toggleStatus('amministratori'),
          },
        ]}
      />

      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Cerca per email, nome o ruolo…"
        resultCount={filtered.length}
        totalCount={visible.length}
        unitSingular="utente"
        unitPlural="utenti"
        onExportExcel={() => exportList('excel')}
        onExportPdf={() => exportList('pdf')}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            {visible.length === 0
              ? 'Nessun utente.'
              : 'Nessun risultato per i filtri selezionati.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={theadRowClass}>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Nome</th>
                  <th className={thClass}>Registrato il</th>
                  <th className={thClass}>Ruolo</th>
                  <th className={thClass}>Password</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      p.role === 'pending' ? `${trClass} bg-amber-50/50` : trClass
                    }
                  >
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
                        actorRole={me?.role}
                        locked={isRoleLocked(p, me?.id)}
                        busy={busyId === p.id}
                        onApprove={(id) => void handleRole(id, 'staff')}
                        onChangeRole={(id, role) => void handleRole(id, role)}
                      />
                      {p.id === me?.id && (
                        <span className="ml-2 text-xs text-slate-400">(tu)</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <ResetUserPassword
                        target={p}
                        actor={me}
                        busy={busyId === p.id}
                        onBusy={(busy) => setBusyId(busy ? p.id : null)}
                        onError={setError}
                        onInfo={setInfo}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ListPagination
        page={page}
        pages={pages}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
      />
    </div>
  )
}
