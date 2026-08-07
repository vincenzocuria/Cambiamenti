import type { PersonType } from '../types/db'
import { courseRequiredRoles, personTypeMeta } from './personTypes'

export interface CourseStaffingCounts {
  teacher: number
  tutor: number
  admin_staff: number
}

export interface StaffingRequirement {
  type: PersonType
  label: string
  current: number
  min: number
  ok: boolean
}

export function staffingRequirements(counts: CourseStaffingCounts): StaffingRequirement[] {
  return courseRequiredRoles.map((type) => {
    const meta = personTypeMeta[type]
    const current = counts[type as keyof CourseStaffingCounts] ?? 0
    return {
      type,
      label: meta.title,
      current,
      min: meta.courseMin,
      ok: current >= meta.courseMin,
    }
  })
}

export function staffingOk(counts: CourseStaffingCounts): boolean {
  return staffingRequirements(counts).every((r) => r.ok)
}
