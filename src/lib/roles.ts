import type { Role } from '../types/db'

/** Unico superadmin dell'app: accesso pieno, non demotabile. */
export const SUPERADMIN_EMAIL = 'curiavincenzo86@gmail.com'

export const roleLabels: Record<Role, string> = {
  superadmin: 'Superadmin',
  admin: 'Amministratore',
  staff: 'Staff',
  pending: 'In attesa',
}

/** Ruoli assegnabili dalla UI (il superadmin resta protetto lato DB). */
export const assignableRoles: Role[] = ['pending', 'staff']

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
