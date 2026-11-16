/** Iter di certificazione ISO 9001: tipi e regole pure. */

export type CertificationStatus = 'in_corso' | 'certificato' | 'sospeso' | 'scaduto' | 'ritirato'
export type StepStatus = 'da_fare' | 'in_corso' | 'fatto' | 'non_applicabile'
export type CertificationFileCategory =
  | 'richiesta'
  | 'dichiarazione'
  | 'rapporto'
  | 'non_conformita'
  | 'certificato'
  | 'corrispondenza'
  | 'altro'

export interface Certification {
  id: string
  standard: string
  sector: string
  scope: string
  body: string
  auditor: string
  consultant: string
  status: CertificationStatus
  certificate_number: string
  issued_on: string | null
  expires_on: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type CertificationInput = Omit<Certification, 'id' | 'created_at' | 'updated_at'>

export interface CertificationStep {
  id: string
  certification_id: string
  sort_order: number
  title: string
  status: StepStatus
  due_on: string | null
  done_on: string | null
  notes: string
  created_at: string
}

export interface CertificationFile {
  id: string
  certification_id: string
  step_id: string | null
  category: CertificationFileCategory
  title: string
  doc_date: string | null
  notes: string
  file_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export const certificationStatusLabels: Record<CertificationStatus, string> = {
  in_corso: 'In corso',
  certificato: 'Certificato',
  sospeso: 'Sospeso',
  scaduto: 'Scaduto',
  ritirato: 'Ritirato',
}

export const stepStatusLabels: Record<StepStatus, string> = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  fatto: 'Fatto',
  non_applicabile: 'Non applicabile',
}

export const fileCategoryLabels: Record<CertificationFileCategory, string> = {
  richiesta: "Richieste dell'auditor / ente",
  dichiarazione: 'Dichiarazioni',
  rapporto: "Rapporti di audit",
  non_conformita: 'Non conformità e azioni correttive',
  certificato: 'Certificato',
  corrispondenza: 'Corrispondenza',
  altro: 'Altro',
}

export function sortSteps(steps: CertificationStep[]): CertificationStep[] {
  return [...steps].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
}

export interface IterProgress {
  done: number
  total: number
  /** prima fase non ancora chiusa: il prossimo passo dell'iter */
  next: CertificationStep | null
  overdue: CertificationStep[]
}

export function iterProgress(steps: CertificationStep[], today: string): IterProgress {
  const relevant = sortSteps(steps).filter((s) => s.status !== 'non_applicabile')
  const open = relevant.filter((s) => s.status !== 'fatto')
  return {
    done: relevant.length - open.length,
    total: relevant.length,
    next: open[0] ?? null,
    overdue: open.filter((s) => !!s.due_on && s.due_on < today),
  }
}

/** Giorni alla scadenza del certificato (negativi se scaduto), null se non c'è. */
export function daysToExpiry(expiresOn: string | null, today: string): number | null {
  if (!expiresOn) return null
  const ms = Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** Sorveglianze annuali e rinnovo a 3 anni dalla data di emissione. */
export function surveillanceDates(issuedOn: string): { surveillance1: string; surveillance2: string; renewal: string } {
  const add = (years: number) => {
    const d = new Date(`${issuedOn}T00:00:00Z`)
    d.setUTCFullYear(d.getUTCFullYear() + years)
    return d.toISOString().slice(0, 10)
  }
  return { surveillance1: add(1), surveillance2: add(2), renewal: add(3) }
}
