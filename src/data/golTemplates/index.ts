import type { DocumentTemplateInput } from '../../types/db'
import { allegato1cBody } from './allegato1c'
import { allegato3cBody } from './allegato3c'
import { allegato5cBody } from './allegato5c'

/** Template GOL da garantire in anagrafica documenti. */
export const golTemplateSeeds: DocumentTemplateInput[] = [
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
]
