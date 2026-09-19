import type { DocumentTemplate, PersonType } from '../types/db'

export function roleMatches(templateRole: string, personType: PersonType | null): boolean {
  if (!personType) return true
  if (templateRole === 'any' || templateRole === 'staff') {
    return (
      personType === 'staff' ||
      personType === 'teacher' ||
      personType === 'tutor' ||
      personType === 'admin_staff'
    )
  }
  if (personType === 'staff') {
    return (
      templateRole === 'teacher' ||
      templateRole === 'tutor' ||
      templateRole === 'admin_staff' ||
      templateRole === 'staff'
    )
  }
  return templateRole === personType
}

export function templateFits(
  t: DocumentTemplate,
  opts: { canHaveCourse: boolean; personType: PersonType | null; canPickPerson: boolean },
): boolean {
  if (t.requires_course && !opts.canHaveCourse) return false
  if (t.person_role === 'none') return true
  if (opts.canPickPerson) {
    if (!opts.personType) return true
    return roleMatches(t.person_role, opts.personType)
  }
  return roleMatches(t.person_role, opts.personType)
}

export function resolveTemplatePersonType(
  template: DocumentTemplate,
  fallback: PersonType | null,
): PersonType | null {
  if (template.person_role === 'any' || template.person_role === 'none') return fallback
  return template.person_role
}
