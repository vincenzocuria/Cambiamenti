import { euroInWords, formatEuro } from './euroInWords'
import { fmtDate, fullName } from './format'

export type ContractStatus = 'bozza' | 'firmato' | 'concluso' | 'risolto'

export interface CollaborationContract {
  id: string
  person_id: string
  role_tutor: boolean
  role_direction: boolean
  role_admin: boolean
  extra_activities: string
  courses_text: string
  location: string
  start_date: string
  end_date: string | null
  gross_amount: number | null
  payment_terms: string
  notice_days: number | null
  privacy_role: string
  signed_on: string | null
  status: ContractStatus
  signed_document_id: string | null
  generated_document_id: string | null
  notes: string
  created_at: string
  updated_at: string
  person?: { id: string; first_name: string; last_name: string; tax_code: string } | null
}

export type ContractInput = Omit<
  CollaborationContract,
  'id' | 'created_at' | 'updated_at' | 'person' | 'signed_document_id' | 'generated_document_id'
>

/** Nome del modello in anagrafica template: il contratto si genera da qui. */
export const COCOCO_TEMPLATE_NAME = 'Contratto co.co.co. — Tutor, Direzione, Amministrazione'

export const DEFAULT_PAYMENT_TERMS =
  'a saldo ogni fine corso, previa presentazione di Nota di Addebito/fattura o altro documento fiscale idoneo'
export const DEFAULT_PRIVACY_ROLE = 'soggetto autorizzato al trattamento'
export const DEFAULT_NOTICE_DAYS = 30

export const statusLabels: Record<ContractStatus, string> = {
  bozza: 'Bozza',
  firmato: 'Firmato',
  concluso: 'Concluso',
  risolto: 'Risolto',
}

export function emptyContract(personId: string): ContractInput {
  const year = new Date().getFullYear()
  return {
    person_id: personId,
    role_tutor: true,
    role_direction: false,
    role_admin: true,
    extra_activities: '',
    courses_text: '',
    location: 'la sede aziendale',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: `${year}-12-31`,
    gross_amount: null,
    payment_terms: DEFAULT_PAYMENT_TERMS,
    notice_days: DEFAULT_NOTICE_DAYS,
    privacy_role: DEFAULT_PRIVACY_ROLE,
    signed_on: null,
    status: 'bozza',
    notes: '',
  }
}

/** «Tutor nonché Direzione e Amministrazione», come nel titolo e nell'art. 2. */
export function rolesPhrase(c: Pick<ContractInput, 'role_tutor' | 'role_direction' | 'role_admin'>): string {
  const office = [c.role_direction && 'Direzione', c.role_admin && 'Amministrazione'].filter(Boolean).join(' e ')
  if (c.role_tutor && office) return `Tutor nonché ${office}`
  if (c.role_tutor) return 'Tutor'
  return office
}

/** «Tutor e Direzione/Amministrazione», come nel sottotitolo del contratto. */
export function rolesTitle(c: Pick<ContractInput, 'role_tutor' | 'role_direction' | 'role_admin'>): string {
  const office = [c.role_direction && 'Direzione', c.role_admin && 'Amministrazione'].filter(Boolean).join('/')
  return [c.role_tutor && 'Tutor', office].filter(Boolean).join(' e ')
}

export function rolesShort(c: Pick<ContractInput, 'role_tutor' | 'role_direction' | 'role_admin'>): string {
  return [c.role_tutor && 'Tutor', c.role_direction && 'Direzione', c.role_admin && 'Amministrazione']
    .filter(Boolean)
    .join(', ')
}

const tutorActivities = [
  "assistenza didattica e organizzativa ai partecipanti durante lo svolgimento delle attività d'aula, di laboratorio e/o a distanza (FAD/e-learning);",
  'supporto ai docenti/formatori nella gestione delle lezioni e nel monitoraggio della frequenza dei partecipanti;',
  'raccordo tra corsisti, docenti e struttura organizzativa del Committente;',
  "gestione della documentazione didattica del corso (registri, fogli firma, materiali didattici), nel rispetto delle procedure indicate dal Committente e/o dall'Ente finanziatore;",
  "monitoraggio dell'andamento didattico e segnalazione al Committente di eventuali criticità.",
]

const directionActivities = [
  "responsabilità della programmazione didattica e organizzativa del corso, in coerenza con il progetto formativo approvato e con le eventuali disposizioni dell'Ente finanziatore;",
  "coordinamento del corpo docente/formatori e definizione, d'intesa con il Committente, del calendario delle lezioni e delle relative sostituzioni;",
  'supervisione della qualità didattica del corso e verifica del raggiungimento degli obiettivi formativi previsti;',
  "rappresentanza del corso nei rapporti con l'Ente finanziatore, gli organismi di controllo e i soggetti terzi coinvolti nel progetto, nei limiti e con le modalità concordate con il Committente;",
  'gestione delle relazioni con i partecipanti in merito ad ammissioni, frequenza, valutazioni finali ed eventuali provvedimenti disciplinari, secondo il regolamento del corso.',
]

const adminActivities = [
  'predisposizione, raccolta e archiviazione della documentazione amministrativa del corso (registri presenze, verbali, rendicontazioni, questionari di gradimento, attestati);',
  "supporto alla rendicontazione economico-finanziaria del progetto formativo nei confronti dell'Ente finanziatore, secondo le linee guida e la modulistica da questo previste;",
  'monitoraggio delle scadenze amministrative del corso (avvio, comunicazioni obbligatorie, chiusura) e tempestiva segnalazione al Committente di eventuali criticità;',
  'collaborazione con gli uffici amministrativi del Committente ai fini della corretta gestione contabile e documentale del progetto.',
]

/** Elenco puntato delle attività (lettere A, B, C solo per le attività scelte). */
export function activitiesText(c: ContractInput): string {
  const sections: [string, string[]][] = []
  if (c.role_tutor) sections.push(['Attività di tutoraggio', tutorActivities])
  if (c.role_direction) sections.push(['Attività di direzione del corso', directionActivities])
  if (c.role_admin) sections.push(['Attività di amministrazione del corso', adminActivities])
  const extra = c.extra_activities.trim()
  return sections
    .map(([title, items], i) => {
      const lines = [...items]
      if (extra && i === sections.length - 1) lines.push(`${extra.replace(/[.;]$/, '')}.`)
      return `${String.fromCharCode(65 + i)}) ${title}\n${lines.map((l) => `• ${l}`).join('\n')}`
    })
    .join('\n\n')
}

const blank = (n: number) => '_'.repeat(n)

/** Variabili {{contratto.*}} per il modello. Se manca il contratto restano righe da compilare a mano. */
export function contractVars(c: ContractInput | null | undefined): Record<string, string> {
  if (!c) {
    return {
      'contratto.attivita_titolo': 'Tutor e Direzione/Amministrazione',
      'contratto.attivita_oggetto': 'Tutor nonché Direzione e Amministrazione',
      'contratto.attivita': blank(60),
      'contratto.corsi': blank(40),
      'contratto.sede': 'la sede aziendale',
      'contratto.data_inizio': blank(10),
      'contratto.data_fine': blank(10),
      'contratto.compenso': blank(12),
      'contratto.compenso_lettere': blank(30),
      'contratto.pagamento': DEFAULT_PAYMENT_TERMS,
      'contratto.preavviso': blank(4),
      'contratto.ruolo_privacy': DEFAULT_PRIVACY_ROLE,
      'contratto.data_firma': blank(12),
    }
  }
  const amount = c.gross_amount
  return {
    'contratto.attivita_titolo': rolesTitle(c),
    'contratto.attivita_oggetto': rolesPhrase(c),
    'contratto.attivita': activitiesText(c),
    'contratto.corsi': c.courses_text.trim() || blank(40),
    'contratto.sede': c.location.trim() || 'la sede aziendale',
    'contratto.data_inizio': fmtDate(c.start_date),
    'contratto.data_fine': c.end_date ? fmtDate(c.end_date) : 'fine delle attività dei corsi oggetto dell’incarico',
    'contratto.compenso': amount != null ? formatEuro(amount) : blank(12),
    'contratto.compenso_lettere': amount != null ? euroInWords(amount) : blank(30),
    'contratto.pagamento': c.payment_terms.trim() || DEFAULT_PAYMENT_TERMS,
    'contratto.preavviso': c.notice_days != null ? String(c.notice_days) : blank(4),
    'contratto.ruolo_privacy': c.privacy_role.trim() || DEFAULT_PRIVACY_ROLE,
    'contratto.data_firma': c.signed_on ? fmtDate(c.signed_on) : blank(12),
  }
}

/** Controlli prima di generare o salvare: messaggi da mostrare, vuoto se tutto ok. */
export function contractWarnings(c: ContractInput): string[] {
  const out: string[] = []
  if (!c.role_tutor && !c.role_direction && !c.role_admin) out.push('Scegli almeno un’attività.')
  if (!c.start_date) out.push('Manca la data di inizio.')
  if (c.end_date && c.start_date && c.end_date < c.start_date) out.push('La data di fine è prima dell’inizio.')
  if (c.gross_amount == null) out.push('Manca il compenso lordo.')
  if (!c.courses_text.trim()) out.push('Indica i corsi oggetto dell’incarico.')
  if (c.notice_days == null) out.push('Indica i giorni di preavviso per il recesso.')
  return out
}

/** Stato calcolato per l'elenco: in corso, in scadenza (entro 60 giorni), scaduto. */
export function contractPhase(
  c: Pick<CollaborationContract, 'start_date' | 'end_date' | 'status'>,
  today = new Date().toISOString().slice(0, 10),
): 'futuro' | 'in_corso' | 'in_scadenza' | 'scaduto' | 'chiuso' {
  if (c.status === 'concluso' || c.status === 'risolto') return 'chiuso'
  if (c.start_date > today) return 'futuro'
  if (!c.end_date) return 'in_corso'
  if (c.end_date < today) return 'scaduto'
  const limit = new Date(`${today}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() + 60)
  return c.end_date <= limit.toISOString().slice(0, 10) ? 'in_scadenza' : 'in_corso'
}

export const phaseLabels: Record<ReturnType<typeof contractPhase>, string> = {
  futuro: 'Da iniziare',
  in_corso: 'In corso',
  in_scadenza: 'In scadenza',
  scaduto: 'Scaduto',
  chiuso: 'Chiuso',
}

export function contractTitle(c: Pick<CollaborationContract, 'start_date' | 'end_date' | 'person'>): string {
  const who = c.person ? fullName(c.person) : ''
  return ['Contratto co.co.co.', who, `${fmtDate(c.start_date)} – ${c.end_date ? fmtDate(c.end_date) : '…'}`]
    .filter(Boolean)
    .join(' — ')
}
