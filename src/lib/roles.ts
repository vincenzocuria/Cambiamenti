import type { Role } from '../types/db'

/** Unico superadmin dell'app: accesso pieno, non demotabile. */
export const SUPERADMIN_EMAIL = 'curiavincenzo86@gmail.com'

export const roleLabels: Record<Role, string> = {
  superadmin: 'Superadmin',
  admin: 'Amministratore',
  staff: 'Staff',
  pending: 'In attesa',
}

/** Ruoli assegnabili da un admin (non include admin/superadmin). */
export const staffAssignableRoles: Role[] = ['pending', 'staff']

/** Ruoli assegnabili dal superadmin (può anche nominare altri admin). */
export const superadminAssignableRoles: Role[] = ['pending', 'staff', 'admin']

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email ?? '') === SUPERADMIN_EMAIL
}

export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === 'superadmin'
}

export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin'
}

export function isStaff(role: Role | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'staff'
}

export function isPending(role: Role | null | undefined): boolean {
  return !role || role === 'pending'
}

/** Ruoli che l'attore può assegnare ad altri utenti. */
export function rolesAssignableBy(actorRole: Role | null | undefined): Role[] {
  if (isSuperAdmin(actorRole)) return superadminAssignableRoles
  if (isAdmin(actorRole)) return staffAssignableRoles
  return []
}

/** Ruoli selezionabili quando si invita un utente nuovo (già abilitato). */
export function inviteRolesBy(actorRole: Role | null | undefined): Role[] {
  if (isSuperAdmin(actorRole)) return ['staff', 'admin']
  if (isAdmin(actorRole)) return ['staff']
  return []
}
