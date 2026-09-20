import type { Profile } from '../types/db'
import { isAdmin, isSuperAdmin } from './roles'
import { isSuperAdminProfile } from './profileVisibility'

/** Admin: staff/pending. Superadmin: tutti, incluso se stesso. */
export function canResetUserPassword(
  actor: Pick<Profile, 'role' | 'email'> | null | undefined,
  target: Pick<Profile, 'role' | 'email'>,
): boolean {
  if (!actor || !isAdmin(actor.role)) return false
  if (isSuperAdminProfile(target)) return isSuperAdminProfile(actor)
  if (isSuperAdmin(actor.role)) return true
  return target.role === 'staff' || target.role === 'pending'
}
