import type { Profile } from '../types/db'
import { isSuperAdmin, isSuperAdminEmail } from './roles'

export function isSuperAdminProfile(p: Pick<Profile, 'role' | 'email'>): boolean {
  return isSuperAdmin(p.role) || isSuperAdminEmail(p.email)
}

/** Il superadmin è visibile solo a se stesso. */
export function visibleToViewer<T extends Pick<Profile, 'role' | 'email'>>(
  profiles: T[],
  viewer: Pick<Profile, 'role' | 'email'> | null | undefined,
): T[] {
  if (viewer && isSuperAdminProfile(viewer)) return profiles
  return profiles.filter((p) => !isSuperAdminProfile(p))
}
