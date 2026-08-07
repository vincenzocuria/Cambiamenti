export const courseStatuses = [
  'bozza',
  'in_creazione',
  'in_attivazione',
  'in_corso',
  'finito',
  'rendicontato',
  'esito_chiuso',
] as const

export type CourseStatus = (typeof courseStatuses)[number]

export interface CourseStatusMeta {
  value: CourseStatus
  label: string
  /** Breve descrizione dello step nel ciclo Regione Calabria */
  description: string
  /** Classi Tailwind per badge */
  badgeClass: string
  order: number
}

export const courseStatusMeta: Record<CourseStatus, CourseStatusMeta> = {
  bozza: {
    value: 'bozza',
    label: 'Bozza',
    description: 'Corso avviato in bozza, dati ancora incompleti.',
    badgeClass: 'bg-slate-100 text-slate-700',
    order: 1,
  },
  in_creazione: {
    value: 'in_creazione',
    label: 'In creazione',
    description: 'Allestimento anagrafiche, organico e documentazione.',
    badgeClass: 'bg-sky-50 text-sky-800',
    order: 2,
  },
  in_attivazione: {
    value: 'in_attivazione',
    label: 'In attivazione',
    description: 'Pratiche di avvio; corso in partenza a breve.',
    badgeClass: 'bg-violet-50 text-violet-800',
    order: 3,
  },
  in_corso: {
    value: 'in_corso',
    label: 'In corso',
    description: 'Formazione attiva.',
    badgeClass: 'bg-emerald-50 text-emerald-800',
    order: 4,
  },
  finito: {
    value: 'finito',
    label: 'Finito',
    description: 'Attività didattica conclusa; da rendicontare.',
    badgeClass: 'bg-amber-50 text-amber-900',
    order: 5,
  },
  rendicontato: {
    value: 'rendicontato',
    label: 'Rendicontato',
    description: 'Rendicontazione inviata/completata.',
    badgeClass: 'bg-orange-50 text-orange-900',
    order: 6,
  },
  esito_chiuso: {
    value: 'esito_chiuso',
    label: 'Esito chiuso',
    description: 'Ciclo Regione Calabria chiuso definitivamente.',
    badgeClass: 'bg-teal-50 text-teal-900',
    order: 7,
  },
}

export const defaultCourseStatus: CourseStatus = 'bozza'

/** Stati considerati “prossimi corsi” (in partenza). */
export const upcomingCourseStatuses: CourseStatus[] = ['in_attivazione']

/** Stati con attività formativa in svolgimento. */
export const activeCourseStatuses: CourseStatus[] = ['in_corso']

/** Finito = in attesa di rendicontazione. */
export const toReportCourseStatuses: CourseStatus[] = ['finito']

export function isCourseStatus(value: string): value is CourseStatus {
  return (courseStatuses as readonly string[]).includes(value)
}

export function courseStatusLabel(status: string | null | undefined): string {
  if (status && isCourseStatus(status)) return courseStatusMeta[status].label
  return courseStatusMeta.bozza.label
}

export function courseStatusBadgeClass(status: string | null | undefined): string {
  if (status && isCourseStatus(status)) return courseStatusMeta[status].badgeClass
  return courseStatusMeta.bozza.badgeClass
}
