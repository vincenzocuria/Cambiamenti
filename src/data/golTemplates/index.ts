import type { DocumentTemplateInput } from '../../types/db'
import { allegato1cBody } from './allegato1c'
import { allegato3cBody } from './allegato3c'
import { allegato5cBody } from './allegato5c'
import { allegato21bBody, mod31bBody } from './staffDeclaration'
import { teacherAppointmentBody } from './teacherAppointment'
import { cococoContractBody } from './cococoContract'
import { COCOCO_TEMPLATE_NAME } from '../../lib/collaborationContract'
import {
  COURSE_END_TEMPLATE,
  COURSE_START_TEMPLATE,
  REPORT_COUNTERSIGN_TEMPLATE,
  courseEndBody,
  courseStartBody,
  reportCountersignBody,
} from './courseLetters'

/** Template GOL da garantire in anagrafica documenti. */
export const golTemplateSeeds: DocumentTemplateInput[] = [
  {
    name: COURSE_START_TEMPLATE,
    description: "Lettera di avvio del corso alla Regione, generata dal passo «Comunicazione di avvio» dell'iter.",
    body: courseStartBody,
    requires_course: true,
    person_role: 'none',
    default_category: 'other',
  },
  {
    name: COURSE_END_TEMPLATE,
    description: "Lettera di conclusione del corso alla Regione, dal passo «Adempimenti conclusivi» dell'iter.",
    body: courseEndBody,
    requires_course: true,
    person_role: 'none',
    default_category: 'other',
  },
  {
    name: REPORT_COUNTERSIGN_TEMPLATE,
    description: "Lettera di trasmissione del verbale controfirmato, dal passo dell'iter.",
    body: reportCountersignBody,
    requires_course: true,
    person_role: 'none',
    default_category: 'report',
  },
  {
    name: 'Allegato 1.c — Autodichiarazione INPS',
    description:
      'Compatibilità/cumulabilità obblighi INPS. Compila la casella dalla prestazione dell’alunno.',
    body: allegato1cBody,
    requires_course: true,
    person_role: 'student',
    default_category: 'module',
  },
  {
    name: 'Allegato 3.c — Modalità di pagamento',
    description: 'Comunicazione IBAN / modalità di pagamento indennità di frequenza.',
    body: allegato3cBody,
    requires_course: true,
    person_role: 'student',
    default_category: 'module',
  },
  {
    name: 'Allegato 5.c — Rinuncia indennità di frequenza',
    description: 'Dichiarazione di rinuncia all’indennità di frequenza GOL.',
    body: allegato5cBody,
    requires_course: true,
    person_role: 'student',
    default_category: 'module',
  },
  {
    name: 'Allegato 2.1.b — Dichiarazione personale docente',
    description: 'Dichiarazione sostitutiva del docente sui rapporti con la Pubblica Amministrazione.',
    body: allegato21bBody,
    requires_course: true,
    person_role: 'teacher',
    default_category: 'module',
  },
  {
    name: 'Mod. 3.1.b — Dichiarazione personale non docente (tutor)',
    description: 'Dichiarazione sostitutiva del tutor sui rapporti con la Pubblica Amministrazione.',
    body: mod31bBody,
    requires_course: true,
    person_role: 'tutor',
    default_category: 'module',
  },
  {
    name: 'Mod. 3.1.b — Dichiarazione personale non docente (amministrativo)',
    description:
      'Dichiarazione sostitutiva del personale amministrativo sui rapporti con la Pubblica Amministrazione.',
    body: mod31bBody,
    requires_course: true,
    person_role: 'admin_staff',
    default_category: 'module',
  },
  {
    name: 'Lettera di incarico docente',
    description: 'Incarico professionale di docenza. Moduli, ore e compenso dall’assegnazione del docente al corso.',
    body: teacherAppointmentBody,
    requires_course: true,
    person_role: 'teacher',
    default_category: 'appointment',
  },
  {
    name: COCOCO_TEMPLATE_NAME,
    description:
      'Contratto di collaborazione coordinata e continuativa del personale interno. Si genera dalla sezione «Contratti di collaborazione» della scheda persona: date, attività, corsi e compenso vengono da lì.',
    body: cococoContractBody,
    requires_course: false,
    person_role: 'staff',
    default_category: 'appointment',
  },
]
