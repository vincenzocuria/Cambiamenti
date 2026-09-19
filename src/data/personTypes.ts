import type { CourseStaffRole, PersonType } from '../types/db'

export type PersonTable = 'students' | 'people'

export interface PersonTypeMeta {
  type: PersonType
  table: PersonTable
  /** Se valorizzato, l'assegnazione corso usa course_staff.role */
  staffRole: CourseStaffRole | null
  title: string
  singular: string
  basePath: string
  courseMin: number
  templatePrefix: string
}

export const personTypeMeta: Record<PersonType, PersonTypeMeta> = {
  student: {
    type: 'student',
    table: 'students',
    staffRole: null,
    title: 'Alunni',
    singular: 'alunno',
    basePath: '/alunni',
    courseMin: 0,
    templatePrefix: 'alunno',
  },
  staff: {
    type: 'staff',
    table: 'people',
    staffRole: null,
    title: 'Personale',
    singular: 'figura',
    basePath: '/personale',
    courseMin: 0,
    templatePrefix: 'persona',
  },
  teacher: {
    type: 'teacher',
    table: 'people',
    staffRole: 'teacher',
    title: 'Docenti',
    singular: 'docente',
    basePath: '/personale',
    courseMin: 1,
    templatePrefix: 'docente',
  },
  tutor: {
    type: 'tutor',
    table: 'people',
    staffRole: 'tutor',
    title: 'Tutor',
    singular: 'tutor',
    basePath: '/personale',
    courseMin: 1,
    templatePrefix: 'tutor',
  },
  admin_staff: {
    type: 'admin_staff',
    table: 'people',
    staffRole: 'admin_staff',
    title: 'Figure amministrative',
    singular: 'figura amministrativa',
    basePath: '/personale',
    courseMin: 3,
    templatePrefix: 'amministrativo',
  },
}

export const courseRequiredRoles: CourseStaffRole[] = ['teacher', 'tutor', 'admin_staff']

export function metaFor(type: PersonType): PersonTypeMeta {
  return personTypeMeta[type]
}

export function isStaffType(type: PersonType): boolean {
  return type === 'staff' || type === 'teacher' || type === 'tutor' || type === 'admin_staff'
}

export function isCourseStaffRole(type: PersonType): type is CourseStaffRole {
  return type === 'teacher' || type === 'tutor' || type === 'admin_staff'
}

export function staffRoleSingular(role: CourseStaffRole): string {
  return personTypeMeta[role].singular
}

/** Tipo usato nei documenti allegati alla scheda. */
export function documentPersonType(type: PersonType): 'student' | 'staff' {
  return type === 'student' ? 'student' : 'staff'
}
