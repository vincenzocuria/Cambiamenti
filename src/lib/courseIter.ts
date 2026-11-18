/**
 * Iter amministrativo di un corso: i passi dal decreto alla chiusura, con le regole per capire
 * da soli quali sono già fatti (dati del corso, organico, verbali, note di debito, incassi, documenti).
 * Funzioni pure: la pagina e il connettore MCP le usano con i dati già letti.
 */

export type CourseStepStatus = 'da_fare' | 'in_corso' | 'fatto' | 'non_applicabile'
export type IterModel = 'gol' | 'standard'
export type IterPhase = 'avvio' | 'svolgimento' | 'chiusura'

/** Sezione della scheda corso dove si fa il lavoro del passo. */
export type IterAction = 'dati' | 'docenti' | 'alunni' | 'documenti' | 'verbali' | 'fatture' | 'genera' | 'presenze'

export interface CourseStep {
  id: string
  course_id: string
  step_key: string | null
  sort_order: number
  title: string
  status: CourseStepStatus
  due_on: string | null
  done_on: string | null
  notes: string
  created_at: string
  updated_at: string
}

/** Quello che il gestionale sa già del corso. */
export interface IterFacts {
  status: string
  code: string | null
  cup: string | null
  fundingProgram: string | null
  fundingDecree: string | null
  startDate: string | null
  endDate: string | null
  durationHours: number | null
  staff: number
  students: number
  lessons: number
  fadDays: number
  reportLines: number
  /** righe di note di debito/fatture collegate al corso */
  invoices: { kind: string; paid: boolean }[]
  documents: { id: string; title: string; file_name: string; category: string }[]
}

export interface IterStepDef {
  key: string
  title: string
  description: string
  phase: IterPhase
  /** solo nel modello GOL */
  golOnly?: boolean
  /** parole che riconoscono il documento del passo tra quelli del corso */
  doc?: RegExp
  /** categoria con cui salvare il documento caricato dal passo */
  category?: 'report' | 'declaration' | 'module' | 'appointment' | 'certificate' | 'other'
  /** se il gestionale lo verifica da solo: il dettaglio quando è fatto, null altrimenti */
  auto?: (f: IterFacts, today: string) => string | null
  action?: IterAction
  actionLabel?: string
  /** scadenza proposta: data di inizio o fine corso più n giorni */
  due?: { from: 'start' | 'end'; days: number }
}

const ORDER = ['bozza', 'in_creazione', 'in_attivazione', 'in_corso', 'finito', 'rendicontato', 'esito_chiuso']
const atLeast = (status: string, target: string) => ORDER.indexOf(status) >= ORDER.indexOf(target)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const ITER_STEPS: IterStepDef[] = [
  // Avvio
  {
    key: 'decreto',
    title: 'Decreto di finanziamento / approvazione',
    description: "Avviso, decreto che approva e finanzia il corso, ID corso assegnato dalla Regione.",
    phase: 'avvio',
    doc: /decret/,
    category: 'other',
    auto: (f) => (f.fundingDecree ? `Decreto ${f.fundingDecree}` : null),
    action: 'dati',
    actionLabel: 'Dati del corso',
  },
  {
    key: 'adesione',
    title: "Atto di adesione / d'obbligo sottoscritto",
    description: "Atto di adesione e obbligo firmato digitalmente e inviato alla Regione.",
    phase: 'avvio',
    doc: /adesion|d'obbligo|atto obbligo|atto di obbligo/,
    category: 'declaration',
  },
  {
    key: 'dati_corso',
    title: 'Dati del corso completi',
    description: 'ID corso, edizione, date di inizio e fine, ore (e CUP quando previsto).',
    phase: 'avvio',
    auto: (f) => (f.code && f.startDate && f.endDate && f.durationHours ? `ID ${f.code}${f.cup ? ` · CUP ${f.cup}` : ''}` : null),
    action: 'dati',
    actionLabel: 'Completa i dati',
    due: { from: 'start', days: -7 },
  },
  {
    key: 'organico',
    title: "Organico e lettere d'incarico",
    description: "Docenti, tutor e amministrativi assegnati, con le lettere d'incarico generate.",
    phase: 'avvio',
    doc: /incaric|nomina/,
    auto: (f) => (f.staff > 0 ? plural(f.staff, 'incarico', 'incarichi') : null),
    action: 'docenti',
    actionLabel: 'Organico',
    due: { from: 'start', days: -1 },
  },
  {
    key: 'allievi',
    title: 'Allievi iscritti e domande di iscrizione',
    description: 'Allievi collegati al corso con i moduli di iscrizione e i documenti.',
    phase: 'avvio',
    auto: (f) => (f.students > 0 ? plural(f.students, 'allievo', 'allievi') : null),
    action: 'alunni',
    actionLabel: 'Allievi',
    due: { from: 'start', days: -1 },
  },
  {
    key: 'calendario',
    title: 'Calendario delle lezioni',
    description: 'Lezioni a calendario (importate dal file del calendario o inserite a mano).',
    phase: 'avvio',
    doc: /calendari/,
    auto: (f) => (f.lessons > 0 ? plural(f.lessons, 'lezione', 'lezioni') : null),
    due: { from: 'start', days: -1 },
  },
  {
    key: 'comunicazione_avvio',
    title: 'Comunicazione di avvio alla Regione',
    description: 'PEC di avvio con calendario, elenco allievi e organico (e vidimazione dei registri se in aula).',
    phase: 'avvio',
    doc: /avvio|vidimaz/,
    category: 'other',
    action: 'genera',
    actionLabel: 'Genera documenti',
    due: { from: 'start', days: 0 },
  },
  // Svolgimento
  {
    key: 'svolgimento',
    title: 'Svolgimento delle lezioni',
    description: 'Il corso si svolge dalla data di inizio alla data di fine.',
    phase: 'svolgimento',
    auto: (f, today) =>
      atLeast(f.status, 'finito') || (f.endDate != null && f.endDate < today) ? `Lezioni concluse${f.endDate ? ` il ${f.endDate.split('-').reverse().join('/')}` : ''}` : null,
    due: { from: 'end', days: 0 },
  },
  {
    key: 'presenze',
    title: 'Registro presenze / presenze FAD',
    description: 'Registro vidimato o presenze FAD dai log Moodle con la dichiarazione per la Regione.',
    phase: 'svolgimento',
    doc: /registro|presenz/,
    auto: (f) => (f.fadDays > 0 ? `${plural(f.fadDays, 'giornata FAD', 'giornate FAD')} dai log Moodle` : null),
    action: 'presenze',
    actionLabel: 'Presenze FAD',
    due: { from: 'end', days: 7 },
  },
  {
    key: 'esami_attestati',
    title: 'Esami finali e attestati',
    description: 'Esame finale (se previsto), attestati rilasciati e consegnati agli allievi.',
    phase: 'svolgimento',
    doc: /attestat|esame|esami|certificaz/,
    category: 'certificate',
    due: { from: 'end', days: 30 },
  },
  // Chiusura e rendicontazione
  {
    key: 'adempimenti_conclusivi',
    title: 'Adempimenti conclusivi e comunicazione di fine corso',
    description: 'Comunicazione di fine attività e documenti richiesti dalla nota sugli adempimenti conclusivi.',
    phase: 'chiusura',
    doc: /conclusiv|fine corso|fine attivit|chiusura/,
    category: 'other',
    due: { from: 'end', days: 30 },
  },
  {
    key: 'rendiconto',
    title: 'Rendiconto caricato su Rendiconta Web',
    description: 'Domanda di rimborso / rendiconto con registri, presenze e spese caricato sul portale della Regione.',
    phase: 'chiusura',
    doc: /rendicont|domanda di rimborso|domanda di saldo/,
    category: 'other',
    due: { from: 'end', days: 60 },
  },
  {
    key: 'verbale',
    title: 'Verbale di verifica della Regione',
    description: 'Verbale con gli importi riconosciuti, anticipo e saldo (caricalo da Documenti: gli importi si leggono da soli).',
    phase: 'chiusura',
    auto: (f) => (f.reportLines > 0 ? plural(f.reportLines, 'riga di verbale caricata', 'righe di verbale caricate') : null),
    action: 'verbali',
    actionLabel: 'Verbali',
  },
  {
    key: 'controfirma_verbale',
    title: 'Verbale controfirmato e caricato su Rendiconta Web',
    description: 'Verbale firmato digitalmente dal legale rappresentante e ricaricato sul portale.',
    phase: 'chiusura',
    doc: /controfirm|verbale[^]*firmat|firmat[^]*verbale/,
    category: 'report',
  },
  {
    key: 'autodichiarazione',
    title: 'Autodichiarazione condizionalità',
    description: "Autodichiarazione sulla condizionalità degli allievi richiesta con il verbale di saldo GOL.",
    phase: 'chiusura',
    golOnly: true,
    doc: /autodichiar|condizionalit/,
    category: 'declaration',
  },
  {
    key: 'nota_debito_saldo',
    title: 'Nota di debito del saldo (TD05)',
    description: 'Nota di debito elettronica del saldo verso la Regione (serie FPA).',
    phase: 'chiusura',
    auto: (f) => (f.invoices.some((i) => i.kind === 'balance') ? 'Nota di debito emessa' : null),
    action: 'fatture',
    actionLabel: 'Note di debito',
  },
  {
    key: 'nota_debito_indennita',
    title: 'Nota di debito delle indennità allievi (TD05)',
    description: 'Nota di debito delle indennità di frequenza GOL anticipate agli allievi.',
    phase: 'chiusura',
    golOnly: true,
    auto: (f) => (f.invoices.some((i) => i.kind === 'allowance') ? 'Nota di debito emessa' : null),
    action: 'fatture',
    actionLabel: 'Note di debito',
  },
  {
    key: 'incasso_saldo',
    title: 'Saldo incassato',
    description: 'Pagamento del saldo ricevuto dalla Regione.',
    phase: 'chiusura',
    auto: (f) => {
      const lines = f.invoices.filter((i) => i.kind === 'balance')
      return lines.length && lines.every((i) => i.paid) ? 'Nota di debito del saldo pagata' : null
    },
    action: 'fatture',
    actionLabel: 'Incassi',
  },
  {
    key: 'incasso_indennita',
    title: 'Indennità incassate',
    description: 'Rimborso delle indennità allievi ricevuto dalla Regione.',
    phase: 'chiusura',
    golOnly: true,
    auto: (f) => {
      const lines = f.invoices.filter((i) => i.kind === 'allowance')
      return lines.length && lines.every((i) => i.paid) ? 'Nota di debito delle indennità pagata' : null
    },
    action: 'fatture',
    actionLabel: 'Incassi',
  },
  {
    key: 'chiusura',
    title: 'Chiusura del corso (esito chiuso)',
    description: 'Tutto incassato e archiviato: il corso passa a «Esito chiuso».',
    phase: 'chiusura',
    auto: (f) => (f.status === 'esito_chiuso' ? 'Corso chiuso' : null),
    action: 'dati',
    actionLabel: 'Cambia stato',
  },
]

export const iterPhaseLabels: Record<IterPhase, string> = {
  avvio: 'Avvio',
  svolgimento: 'Svolgimento',
  chiusura: 'Chiusura e rendicontazione',
}

export const iterModelLabels: Record<IterModel, string> = {
  gol: 'GOL (con indennità e autodichiarazione)',
  standard: 'Altri avvisi',
}

export const courseStepStatusLabels: Record<CourseStepStatus, string> = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  fatto: 'Fatto',
  non_applicabile: 'Non applicabile',
}

const DEF_BY_KEY = new Map(ITER_STEPS.map((d) => [d.key, d]))

export function stepDef(key: string | null): IterStepDef | undefined {
  return key ? DEF_BY_KEY.get(key) : undefined
}

/** Il modello proposto: GOL se il programma o il nome lo dicono. */
export function guessIterModel(course: { name?: string | null; funding_program?: string | null }): IterModel {
  return /\bgol\b|garanzia di occupabilit/i.test(`${course.funding_program ?? ''} ${course.name ?? ''}`) ? 'gol' : 'standard'
}

export function modelSteps(model: IterModel): IterStepDef[] {
  return ITER_STEPS.filter((d) => model === 'gol' || !d.golOnly)
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Scadenza proposta dal modello, se il corso ha le date. */
export function defaultDue(def: IterStepDef | undefined, startDate: string | null, endDate: string | null): string | null {
  if (!def?.due) return null
  const base = def.due.from === 'start' ? startDate : endDate
  return base ? addDays(base.slice(0, 10), def.due.days) : null
}

/** Le righe da creare per un modello (sort_order a passi di 10 per poter inserire passi in mezzo). */
export function iterRows(model: IterModel, courseId: string, startDate: string | null, endDate: string | null) {
  return modelSteps(model).map((d, i) => ({
    course_id: courseId,
    step_key: d.key,
    sort_order: (i + 1) * 10,
    title: d.title,
    due_on: defaultDue(d, startDate, endDate),
  }))
}

export type EffectiveState = 'fatto' | 'non_applicabile' | 'in_corso' | 'da_fare'

export interface EvaluatedStep {
  step: CourseStep
  def: IterStepDef | undefined
  state: EffectiveState
  /** fatto senza che nessuno l'abbia segnato: lo dice il gestionale */
  autoDone: boolean
  /** perché risulta fatto (dato del corso o documento trovato) */
  evidence: string | null
  /** documenti collegati al passo o riconosciuti dal nome */
  documentIds: string[]
  overdue: boolean
}

const norm = (s: string) => s.toLowerCase()

/** Stato effettivo di ogni passo: quello segnato a mano vince, poi i dati del corso e i documenti. */
export function evaluateIter(
  steps: CourseStep[],
  facts: IterFacts,
  linked: Map<string, string[]>,
  today: string,
): EvaluatedStep[] {
  const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  return sorted.map((step) => {
    const def = stepDef(step.step_key)
    const own = linked.get(step.id) ?? []
    const found = def?.doc
      ? facts.documents.filter((d) => !own.includes(d.id) && def.doc!.test(norm(`${d.title} ${d.file_name}`))).map((d) => d.id)
      : []
    const documentIds = [...own, ...found]
    const autoDetail = def?.auto?.(facts, today) ?? null
    let state: EffectiveState = step.status
    let autoDone = false
    let evidence: string | null = null
    if (step.status === 'da_fare' || step.status === 'in_corso') {
      if (autoDetail) {
        evidence = autoDetail
      } else if (own.length) {
        evidence = own.length === 1 ? 'Documento caricato' : `${own.length} documenti caricati`
      } else if (found.length) {
        const doc = facts.documents.find((d) => d.id === found[0])!
        evidence = `Trovato «${doc.title || doc.file_name}»`
      }
      if (evidence) {
        state = 'fatto'
        autoDone = true
      }
    } else if (step.status === 'fatto') {
      evidence = autoDetail
    }
    const overdue = (state === 'da_fare' || state === 'in_corso') && !!step.due_on && step.due_on < today
    return { step, def, state, autoDone, evidence, documentIds, overdue }
  })
}

export interface IterSummary {
  done: number
  total: number
  next: EvaluatedStep | null
  overdue: EvaluatedStep[]
}

export function summarizeIter(evaluated: EvaluatedStep[]): IterSummary {
  const relevant = evaluated.filter((e) => e.state !== 'non_applicabile')
  const open = relevant.filter((e) => e.state !== 'fatto')
  return {
    done: relevant.length - open.length,
    total: relevant.length,
    next: open[0] ?? null,
    overdue: open.filter((e) => e.overdue),
  }
}
