/** Sistema qualità ISO 9001: tipi e regole pure (elenco master, attestati, questionari). */

// --- Elenco master documenti ------------------------------------------------------------------

export type QualityArea = 'direzione' | 'risorse' | 'erogazione' | 'fornitori' | 'miglioramento'
export type QualityStatus = 'da_predisporre' | 'bozza' | 'vigente' | 'superato'
export type QualityOrigin = 'interno' | 'esterno'

export interface QualityDocument {
  id: string
  code: string
  title: string
  origin: QualityOrigin
  area: QualityArea
  iso_clause: string
  status: QualityStatus
  revision: string
  issued_on: string | null
  review_due_on: string | null
  owner: string
  location: string
  notes: string
  file_name: string
  storage_path: string | null
  mime_type: string
  size_bytes: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type QualityDocumentInput = Pick<
  QualityDocument,
  | 'code'
  | 'title'
  | 'origin'
  | 'area'
  | 'iso_clause'
  | 'status'
  | 'revision'
  | 'issued_on'
  | 'review_due_on'
  | 'owner'
  | 'location'
  | 'notes'
>

export const areaLabels: Record<QualityArea, string> = {
  direzione: 'Contesto e leadership',
  risorse: 'Risorse e competenze',
  erogazione: 'Erogazione del servizio',
  fornitori: 'Fornitori esterni',
  miglioramento: 'Valutazione e miglioramento',
}

export const statusLabels: Record<QualityStatus, string> = {
  da_predisporre: 'Da predisporre',
  bozza: 'In bozza',
  vigente: 'Vigente',
  superato: 'Superato',
}

export const originLabels: Record<QualityOrigin, string> = {
  interno: 'Interno',
  esterno: 'Esterno',
}

/** Il riesame è scaduto se la data è passata (solo per i documenti vigenti). */
export function reviewOverdue(d: Pick<QualityDocument, 'status' | 'review_due_on'>, today: string): boolean {
  return d.status === 'vigente' && !!d.review_due_on && d.review_due_on < today
}

export interface QualityFilter {
  area: QualityArea | 'tutte'
  status: QualityStatus | 'tutti' | 'mancanti'
  query: string
}

export function filterQualityDocuments(docs: QualityDocument[], f: QualityFilter): QualityDocument[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return docs.filter((d) => {
    if (f.area !== 'tutte' && d.area !== f.area) return false
    if (f.status === 'mancanti') {
      if (d.status === 'vigente' || d.status === 'superato') return false
    } else if (f.status !== 'tutti' && d.status !== f.status) return false
    if (!words.length) return true
    const hay = [d.code, d.title, d.iso_clause, d.owner, d.location, d.notes, d.revision, d.file_name]
      .join(' ')
      .toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

const areaOrder: QualityArea[] = ['direzione', 'risorse', 'erogazione', 'fornitori', 'miglioramento']

export function sortQualityDocuments(docs: QualityDocument[]): QualityDocument[] {
  return [...docs].sort(
    (a, b) =>
      areaOrder.indexOf(a.area) - areaOrder.indexOf(b.area) ||
      a.sort_order - b.sort_order ||
      a.code.localeCompare(b.code) ||
      a.title.localeCompare(b.title),
  )
}

export interface QualityProgress {
  total: number
  ready: number
  draft: number
  missing: number
  overdue: number
}

export function qualityProgress(docs: QualityDocument[], today: string): QualityProgress {
  const active = docs.filter((d) => d.status !== 'superato')
  return {
    total: active.length,
    ready: active.filter((d) => d.status === 'vigente').length,
    draft: active.filter((d) => d.status === 'bozza').length,
    missing: active.filter((d) => d.status === 'da_predisporre').length,
    overdue: active.filter((d) => reviewOverdue(d, today)).length,
  }
}

// --- Registro attestati -----------------------------------------------------------------------

export interface Certificate {
  id: string
  year: number
  number: number
  issued_on: string
  course_id: string | null
  student_id: string | null
  holder_name: string
  holder_tax_code: string
  title: string
  hours: number | null
  outcome: string
  delivered_on: string | null
  delivery_method: string
  document_id: string | null
  notes: string
  cancelled_at: string | null
  cancelled_reason: string
  created_at: string
  course?: { id: string; name: string; code: string | null; edition: string | null } | null
}

/** «12/2026»: il numero come si scrive sull'attestato. */
export function certificateLabel(c: Pick<Certificate, 'number' | 'year'>): string {
  return `${c.number}/${c.year}`
}

export function sortCertificates(list: Certificate[]): Certificate[] {
  return [...list].sort((a, b) => b.year - a.year || b.number - a.number)
}

export type DeliveryFilter = 'tutti' | 'consegnati' | 'da_consegnare' | 'annullati'

export interface CertificateFilter {
  year: number | 'tutti'
  delivery: DeliveryFilter
  query: string
}

function courseText(c: Certificate['course']): string {
  if (!c) return ''
  return [c.code, c.name, c.edition].filter(Boolean).join(' ')
}

export function filterCertificates(list: Certificate[], f: CertificateFilter): Certificate[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter((c) => {
    if (f.year !== 'tutti' && c.year !== f.year) return false
    if (f.delivery === 'annullati' && !c.cancelled_at) return false
    if (f.delivery !== 'annullati' && f.delivery !== 'tutti' && c.cancelled_at) return false
    if (f.delivery === 'consegnati' && !c.delivered_on) return false
    if (f.delivery === 'da_consegnare' && c.delivered_on) return false
    if (!words.length) return true
    const hay = [certificateLabel(c), c.holder_name, c.holder_tax_code, c.title, c.outcome, c.notes, courseText(c.course)]
      .join(' ')
      .toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Allievi del corso che non hanno ancora un attestato valido con quel titolo. */
export function studentsWithoutCertificate(
  studentIds: string[],
  certificates: Pick<Certificate, 'student_id' | 'title' | 'cancelled_at'>[],
  title: string,
): string[] {
  const done = new Set(
    certificates.filter((c) => !c.cancelled_at && c.title === title && c.student_id).map((c) => c.student_id as string),
  )
  return studentIds.filter((id) => !done.has(id))
}

// --- Questionari di gradimento ----------------------------------------------------------------

export interface SurveyQuestion {
  id: string
  text: string
}

export interface SurveyGroup {
  id: string
  title: string
  questions: SurveyQuestion[]
}

/** Le domande del questionario: gli id devono restare uguali a quelli ammessi da survey_submit. */
export const surveyGroups: SurveyGroup[] = [
  {
    id: 'docenza',
    title: 'Docenza',
    questions: [
      { id: 'docenza_chiarezza', text: 'I docenti hanno spiegato in modo chiaro' },
      { id: 'docenza_competenza', text: 'I docenti conoscevano bene la materia' },
      { id: 'docenza_disponibilita', text: 'I docenti sono stati disponibili a rispondere alle domande' },
    ],
  },
  {
    id: 'organizzazione',
    title: 'Organizzazione',
    questions: [
      { id: 'organizzazione_calendario', text: 'Il calendario e gli orari sono stati rispettati' },
      { id: 'organizzazione_segreteria', text: 'La segreteria è stata disponibile e puntuale' },
      { id: 'organizzazione_informazioni', text: "Le informazioni prima e durante il corso sono state chiare" },
    ],
  },
  {
    id: 'materiale',
    title: 'Materiale didattico',
    questions: [
      { id: 'materiale_qualita', text: 'Il materiale (dispense, slide) era chiaro e completo' },
      { id: 'materiale_utilita', text: 'Il materiale mi sarà utile anche dopo il corso' },
    ],
  },
  {
    id: 'ambiente',
    title: 'Aule e piattaforma',
    questions: [
      { id: 'ambiente_aule', text: 'Le aule e le attrezzature erano adeguate (se il corso era in presenza)' },
      { id: 'ambiente_piattaforma', text: 'La piattaforma online ha funzionato bene (se il corso era a distanza)' },
    ],
  },
  {
    id: 'complessivo',
    title: 'Giudizio complessivo',
    questions: [
      { id: 'complessivo_obiettivi', text: 'Il corso ha raggiunto gli obiettivi annunciati' },
      { id: 'complessivo_aspettative', text: 'Il corso ha soddisfatto le mie aspettative' },
      { id: 'complessivo_consiglio', text: 'Consiglierei questo corso ad altri' },
    ],
  },
]

export const surveyQuestionIds = surveyGroups.flatMap((g) => g.questions.map((q) => q.id))

export const scaleLabels: Record<number, string> = {
  1: 'Per niente',
  2: 'Poco',
  3: 'Abbastanza',
  4: 'Molto',
  5: 'Moltissimo',
}

export interface Survey {
  id: string
  course_id: string
  token: string
  closes_on: string | null
  closed_at: string | null
  created_at: string
}

export interface SurveyResponse {
  id: string
  survey_id: string
  scores: Record<string, number>
  teacher_scores: Record<string, number>
  liked: string
  suggestions: string
  submitted_at: string
}

export function surveyIsOpen(s: Pick<Survey, 'closes_on' | 'closed_at'>, today: string): boolean {
  return !s.closed_at && (!s.closes_on || s.closes_on >= today)
}

export function surveyUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/questionario/${token}`
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
}

export interface SurveySummary {
  responses: number
  /** media 1..5 per domanda (null se nessuno ha risposto) */
  byQuestion: Record<string, number | null>
  byGroup: Record<string, number | null>
  byTeacher: Record<string, { mean: number | null; count: number }>
  overall: number | null
  /** quota di risposte con media ≥ 3,5 (soddisfatti) */
  satisfiedShare: number | null
  comments: { liked: string; suggestions: string; submitted_at: string }[]
}

export function summarizeResponses(responses: Pick<SurveyResponse, 'scores' | 'teacher_scores' | 'liked' | 'suggestions' | 'submitted_at'>[]): SurveySummary {
  const valid = (v: unknown): v is number => typeof v === 'number' && v >= 1 && v <= 5
  const byQuestion: Record<string, number | null> = {}
  for (const id of surveyQuestionIds) {
    byQuestion[id] = mean(responses.map((r) => r.scores?.[id]).filter(valid))
  }
  const byGroup: Record<string, number | null> = {}
  for (const g of surveyGroups) {
    byGroup[g.id] = mean(responses.flatMap((r) => g.questions.map((q) => r.scores?.[q.id]).filter(valid)))
  }
  const teacherValues = new Map<string, number[]>()
  for (const r of responses) {
    for (const [id, v] of Object.entries(r.teacher_scores ?? {})) {
      if (!valid(v)) continue
      teacherValues.set(id, [...(teacherValues.get(id) ?? []), v])
    }
  }
  const byTeacher: SurveySummary['byTeacher'] = {}
  for (const [id, values] of teacherValues) byTeacher[id] = { mean: mean(values), count: values.length }

  const perResponse = responses
    .map((r) => mean(Object.values(r.scores ?? {}).filter(valid)))
    .filter((v): v is number => v != null)
  const overall = mean(responses.flatMap((r) => Object.values(r.scores ?? {}).filter(valid)))
  const satisfiedShare = perResponse.length
    ? Math.round((perResponse.filter((v) => v >= 3.5).length / perResponse.length) * 100) / 100
    : null
  const comments = responses
    .filter((r) => r.liked.trim() || r.suggestions.trim())
    .map((r) => ({ liked: r.liked.trim(), suggestions: r.suggestions.trim(), submitted_at: r.submitted_at }))
  return { responses: responses.length, byQuestion, byGroup, byTeacher, overall, satisfiedShare, comments }
}

/** «4,25» con la virgola, «—» se manca. */
export function fmtScore(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(2).replace('.', ',')
}

/** Risposte mancanti: le domande senza voto, per avvisare prima dell'invio. */
export function unansweredQuestions(scores: Record<string, number>, skippable: string[] = []): string[] {
  return surveyQuestionIds.filter((id) => !skippable.includes(id) && !(scores[id] >= 1 && scores[id] <= 5))
}
