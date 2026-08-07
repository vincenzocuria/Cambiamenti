import { courseStatusLabel } from '../data/courseStatus'
import { school } from '../data/school'
import type { Course, Person, PersonType } from '../types/db'
import { fmtDate, fullName } from './format'

function personVars(person: Person, prefix: string): Record<string, string> {
  return {
    [`${prefix}.nome`]: person.first_name,
    [`${prefix}.cognome`]: person.last_name,
    [`${prefix}.nome_completo`]: fullName(person),
    [`${prefix}.cf`]: person.tax_code,
    [`${prefix}.indirizzo`]: [person.address, person.postal_code, person.city, person.province]
      .filter(Boolean)
      .join(', '),
    [`${prefix}.citta`]: person.city,
    [`${prefix}.email`]: person.email,
    [`${prefix}.email_fad`]: person.fad_email || person.email,
    [`${prefix}.password_fad`]: person.fad_password,
    [`${prefix}.telefono`]: person.phone,
    [`${prefix}.iban`]: person.iban,
    [`${prefix}.banca`]: person.bank_name,
    [`${prefix}.bic`]: person.bic,
  }
}

export function buildTemplateContext(input: {
  course?: Course | null
  person?: Person | null
  personType?: PersonType | null
}): Record<string, string> {
  const vars: Record<string, string> = {
    'scuola.nome': school.name,
    'scuola.indirizzo': school.address,
    'scuola.piva': school.vatNumber,
    'scuola.rea': school.rea,
    'scuola.email': school.email,
    'scuola.telefono': school.phone,
    'scuola.sdi': school.sdiCode,
    oggi: fmtDate(new Date().toISOString()),
  }

  const course = input.course
  if (course) {
    Object.assign(vars, {
      'corso.nome': course.name,
      'corso.edizione': course.edition,
      'corso.codice': course.code,
      'corso.cup': course.cup,
      'corso.stato': courseStatusLabel(course.status),
      'corso.data_inizio': fmtDate(course.start_date),
      'corso.data_fine': fmtDate(course.end_date),
      'corso.ore': course.duration_hours != null ? String(course.duration_hours) : '',
      'corso.note': course.notes,
    })
  }

  const person = input.person
  if (person) {
    Object.assign(vars, personVars(person, 'persona'))
    if (input.personType === 'student') Object.assign(vars, personVars(person, 'alunno'))
    if (input.personType === 'teacher') Object.assign(vars, personVars(person, 'docente'))
    if (input.personType === 'tutor') Object.assign(vars, personVars(person, 'tutor'))
    if (input.personType === 'admin_staff') {
      Object.assign(vars, personVars(person, 'amministrativo'))
    }
    if (input.personType === 'staff') {
      Object.assign(vars, personVars(person, 'docente'))
      Object.assign(vars, personVars(person, 'tutor'))
      Object.assign(vars, personVars(person, 'amministrativo'))
    }
  }

  return vars
}
