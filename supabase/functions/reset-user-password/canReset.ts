import { isSuperAdminEmail } from '../_shared/securityConfig.ts'

function isSuper(role: string, email: string): boolean {
  return role === 'superadmin' || isSuperAdminEmail(email)
}

export function canResetPassword(opts: {
  actorRole: string
  actorEmail: string
  targetRole: string
  targetEmail: string
}): boolean {
  const actorSuper = isSuper(opts.actorRole, opts.actorEmail)
  const targetSuper = isSuper(opts.targetRole, opts.targetEmail)
  if (targetSuper) return actorSuper
  if (actorSuper) return true
  if (opts.actorRole !== 'admin') return false
  return opts.targetRole === 'staff' || opts.targetRole === 'pending'
}
