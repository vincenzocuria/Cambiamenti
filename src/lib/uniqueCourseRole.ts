import { staffRoleSingular } from '../data/personTypes'
import type { CourseStaffRole } from '../types/db'

/** Una figura non può ricoprire due ruoli sullo stesso corso. */
export function uniqueCourseRoleMessage(existingRole: CourseStaffRole): string {
  return `Questa figura è già associata al corso come ${staffRoleSingular(existingRole)}. Ogni persona può avere un solo ruolo per corso.`
}
