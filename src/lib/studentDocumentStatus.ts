import type { Person } from '../types/db'

export const studentDocumentGapLabels = {
  file: 'File identità assente',
  dati: 'Tipo o numero mancante',
  scadenza: 'Scadenza assente',
  scaduto: 'Documento scaduto',
} as const

export type StudentDocumentGap = keyof typeof studentDocumentGapLabels

export type StudentDocumentCheck = {
  ok: boolean
  gaps: StudentDocumentGap[]
}

type IdentityFields = Pick<Person, 'doc_type' | 'doc_number' | 'doc_expiry_date'>

/** Data locale YYYY-MM-DD, senza spostare il giorno per il fuso. */
export function calendarDateIso(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Fascicolo identità completo: file caricato, tipo, numero e scadenza non passata. */
export function checkStudentDocuments(
  person: IdentityFields,
  hasIdentityFile: boolean,
  today = calendarDateIso(),
): StudentDocumentCheck {
  const gaps: StudentDocumentGap[] = []
  if (!hasIdentityFile) gaps.push('file')
  if (!person.doc_type.trim() || !person.doc_number.trim()) gaps.push('dati')
  const expiry = person.doc_expiry_date?.trim() ?? ''
  if (!expiry) gaps.push('scadenza')
  else if (expiry < today) gaps.push('scaduto')
  return { ok: gaps.length === 0, gaps }
}

export type StudentDocumentStatusLabel =
  | 'Documenti ok'
  | 'Documenti mancanti'
  | 'Dati incompleti'
  | 'Documento scaduto'

/** Etichetta visibile: il file caricato non va confuso con dati incompleti o scadenza passata. */
export function studentDocumentStatusLabel(check: StudentDocumentCheck): StudentDocumentStatusLabel {
  if (check.ok) return 'Documenti ok'
  if (check.gaps.includes('file')) return 'Documenti mancanti'
  if (check.gaps.includes('dati') || check.gaps.includes('scadenza')) return 'Dati incompleti'
  return 'Documento scaduto'
}

export function studentDocumentGapSummary(gaps: StudentDocumentGap[]): string {
  return gaps.map((gap) => studentDocumentGapLabels[gap]).join(', ')
}

export function studentDocumentExportValue(check: StudentDocumentCheck): string {
  const label = studentDocumentStatusLabel(check)
  if (check.ok) return label
  const summary = studentDocumentGapSummary(check.gaps)
  if (!summary || summary === label) return label
  return `${label}: ${summary}`
}
