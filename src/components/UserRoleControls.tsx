import type { Profile, Role } from '../types/db'
import { PrimaryButton } from './Buttons'
import { roleLabels, rolesAssignableBy } from '../lib/roles'

interface Props {
  profile: Profile
  actorRole: Role | null | undefined
  locked: boolean
  busy?: boolean
  onApprove: (id: string) => void
  onChangeRole: (id: string, role: Role) => void
}

/** Controlli ruolo: Approva per pending, altrimenti select. */
export function UserRoleControls({
  profile,
  actorRole,
  locked,
  busy,
  onApprove,
  onChangeRole,
}: Props) {
  const options = rolesAssignableBy(actorRole)
  const canEdit = !locked && (profile.role === 'pending' || options.includes(profile.role))

  if (!canEdit) {
    return (
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
        {roleLabels[profile.role]}
      </span>
    )
  }

  if (profile.role === 'pending') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton
          type="button"
          disabled={busy}
          className="!px-3 !py-1 !text-xs"
          onClick={() => onApprove(profile.id)}
        >
          Approva (Staff)
        </PrimaryButton>
        <select
          value="pending"
          disabled={busy}
          onChange={(e) => void onChangeRole(profile.id, e.target.value as Role)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
        >
          {options.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <select
      value={profile.role}
      disabled={busy}
      onChange={(e) => void onChangeRole(profile.id, e.target.value as Role)}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
    >
      {options.map((role) => (
        <option key={role} value={role}>
          {roleLabels[role]}
        </option>
      ))}
    </select>
  )
}
