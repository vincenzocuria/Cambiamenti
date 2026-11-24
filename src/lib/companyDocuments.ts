/** Documenti della società: tipi e regole pure (categorie, scadenze, filtri). */

export type CompanyDocCategory =
  | 'societari'
  | 'accreditamento'
  | 'fiscali'
  | 'sede'
  | 'polizze'
  | 'certificazioni'
  | 'privacy'
  | 'contratti'
  | 'altro'

export interface CompanyDocument {
  id: string
  category: CompanyDocCategory
  title: string
  issuer: string
  reference: string
  issued_on: string | null
  expires_on: string | null
  notes: string
  file_name: string
  storage_path: string | null
  mime_type: string
  size_bytes: number
  quality_document_id: string | null
  replaces_id: string | null
  superseded_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type CompanyDocumentInput = Pick<
  CompanyDocument,
  'category' | 'title' | 'issuer' | 'reference' | 'issued_on' | 'expires_on' | 'notes' | 'quality_document_id'
>

export const categoryOrder: CompanyDocCategory[] = [
  'societari',
  'accreditamento',
  'fiscali',
  'sede',
  'polizze',
  'certificazioni',
  'privacy',
  'contratti',
  'altro',
]

export const companyCategoryLabels: Record<CompanyDocCategory, string> = {
  societari: 'Atti societari',
  accreditamento: 'Accreditamenti e autorizzazioni',
  fiscali: 'Fiscali e contributivi',
  sede: 'Sede e sicurezza',
  polizze: 'Polizze e garanzie',
  certificazioni: 'Certificazioni',
  privacy: 'Privacy',
  contratti: 'Contratti e convenzioni',
  altro: 'Altro',
}

export const companyCategoryHints: Record<CompanyDocCategory, string> = {
  societari: 'visura, atto costitutivo, statuto, verbali di assemblea',
  accreditamento: 'accreditamento regionale, test center, autorizzazioni',
  fiscali: 'DURC, partita IVA, regolarità fiscale, conto dedicato',
  sede: 'locazione, planimetrie, DVR, agibilità, impianti',
  polizze: 'RC, infortuni, fideiussioni',
  certificazioni: 'ISO 9001 e altri certificati',
  privacy: 'registro trattamenti, nomine, informative',
  contratti: 'convenzioni con enti e partner, fornitori',
  altro: '',
}

/** Giorni di avviso prima della scadenza. */
export const EXPIRY_WARN_DAYS = 30

export type ExpiryState = 'scaduto' | 'in_scadenza' | 'valido' | null

const DAY = 86_400_000

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY)
}

/** Stato della scadenza di una voce corrente (le superate non scadono più). */
export function expiryState(d: Pick<CompanyDocument, 'expires_on' | 'superseded_at'>, today: string): ExpiryState {
  if (d.superseded_at || !d.expires_on) return null
  if (d.expires_on < today) return 'scaduto'
  return daysUntil(d.expires_on, today) <= EXPIRY_WARN_DAYS ? 'in_scadenza' : 'valido'
}

/** «scade oggi», «scade tra 12 giorni», «scaduto da 3 giorni». */
export function expiryLabel(expiresOn: string, today: string): string {
  const diff = daysUntil(expiresOn, today)
  if (diff === 0) return 'scade oggi'
  if (diff === 1) return 'scade domani'
  if (diff === -1) return 'scaduto ieri'
  if (diff < 0) return `scaduto da ${-diff} giorni`
  return `scade tra ${diff} giorni`
}

/** Aggiunge giorni a una data AAAA-MM-GG (in UTC, senza problemi di ora legale). */
export function addDaysIso(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * DAY
  return new Date(t).toISOString().slice(0, 10)
}

/** Validità tipica per i documenti che hanno una durata fissa (in giorni dalla data di rilascio). */
export function defaultValidityDays(title: string): number | null {
  if (/\bdurc\b/i.test(title)) return 120
  return null
}

/** Scadenza proposta quando si inserisce la data di rilascio e la scadenza è vuota. */
export function suggestedExpiry(title: string, issuedOn: string | null): string | null {
  const days = defaultValidityDays(title)
  return days && issuedOn ? addDaysIso(issuedOn, days) : null
}

export interface CompanyFilter {
  category: CompanyDocCategory | 'tutte'
  view: 'correnti' | 'da_caricare' | 'scadenze' | 'superati'
  query: string
}

export function filterCompanyDocuments(docs: CompanyDocument[], f: CompanyFilter, today: string): CompanyDocument[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return docs.filter((d) => {
    if (f.category !== 'tutte' && d.category !== f.category) return false
    if (f.view === 'superati') {
      if (!d.superseded_at) return false
    } else {
      if (d.superseded_at) return false
      if (f.view === 'da_caricare' && d.storage_path) return false
      if (f.view === 'scadenze') {
        const s = expiryState(d, today)
        if (s !== 'scaduto' && s !== 'in_scadenza') return false
      }
    }
    if (!words.length) return true
    const hay = [d.title, d.issuer, d.reference, d.notes, d.file_name, companyCategoryLabels[d.category]]
      .join(' ')
      .toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

export function sortCompanyDocuments(docs: CompanyDocument[]): CompanyDocument[] {
  return [...docs].sort(
    (a, b) =>
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
      a.sort_order - b.sort_order ||
      a.title.localeCompare(b.title) ||
      // a parità di nome, la versione più recente prima
      (b.issued_on ?? '').localeCompare(a.issued_on ?? '') ||
      b.created_at.localeCompare(a.created_at),
  )
}

export interface CompanyProgress {
  total: number
  loaded: number
  missing: number
  expired: number
  expiring: number
}

export function companyProgress(docs: CompanyDocument[], today: string): CompanyProgress {
  const current = docs.filter((d) => !d.superseded_at)
  return {
    total: current.length,
    loaded: current.filter((d) => d.storage_path).length,
    missing: current.filter((d) => !d.storage_path).length,
    expired: current.filter((d) => expiryState(d, today) === 'scaduto').length,
    expiring: current.filter((d) => expiryState(d, today) === 'in_scadenza').length,
  }
}

/** Voci correnti scadute o in scadenza, la più urgente prima (per la dashboard). */
export function expiringCompanyDocuments(docs: CompanyDocument[], today: string): CompanyDocument[] {
  return docs
    .filter((d) => {
      const s = expiryState(d, today)
      return s === 'scaduto' || s === 'in_scadenza'
    })
    .sort((a, b) => (a.expires_on ?? '').localeCompare(b.expires_on ?? ''))
}

/** Dati della nuova versione di un documento rinnovato: stessi dati, date e file da rifare. */
export function renewalInput(d: CompanyDocument): CompanyDocumentInput {
  return {
    category: d.category,
    title: d.title,
    issuer: d.issuer,
    reference: '',
    issued_on: null,
    expires_on: null,
    notes: d.notes,
    quality_document_id: d.quality_document_id,
  }
}
