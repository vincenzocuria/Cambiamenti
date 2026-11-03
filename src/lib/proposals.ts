/**
 * Proposte (tabella proposals): tipi, forma dei dati e righe «ora → proposto»
 * mostrate nella pagina Proposte. Il connettore MCP le crea, la pagina le applica se accettate.
 */

export const proposalKinds = [
  'crea_corso',
  'aggiorna_corso',
  'cambia_stato_corso',
  'aggiungi_nota_corso',
  'registra_pagamento',
  'allega_documento',
  'aggiungi_lezione',
] as const

export type ProposalKind = (typeof proposalKinds)[number]
export type ProposalStatus = 'proposta' | 'applicata' | 'rifiutata' | 'errore'

export const proposalKindLabel: Record<ProposalKind, string> = {
  crea_corso: 'Nuovo corso',
  aggiorna_corso: 'Dati del corso',
  cambia_stato_corso: 'Stato del corso',
  aggiungi_nota_corso: 'Nota sul corso',
  registra_pagamento: 'Pagamento',
  allega_documento: 'Documento',
  aggiungi_lezione: 'Lezione',
}

/** Campi del corso che una proposta può impostare. */
export const courseFieldLabel: Record<string, string> = {
  name: 'Nome',
  edition: 'Edizione',
  code: 'ID corso',
  cup: 'CUP',
  start_date: 'Data inizio',
  end_date: 'Data fine',
  duration_hours: 'Ore',
  funding_program: 'Avviso / programma',
  funding_decree: 'Decreto di finanziamento',
  status: 'Stato',
  notes: 'Note',
}

export const COURSE_FIELDS = Object.keys(courseFieldLabel)

export interface ProposalRow {
  id: string
  kind: ProposalKind
  course_id: string | null
  pec_message_id: string | null
  title: string
  reason: string
  payload: Record<string, unknown>
  current_values: Record<string, unknown>
  status: ProposalStatus
  result: string
  created_at: string
  decided_at: string | null
}

export interface DiffRow {
  label: string
  before: string
  after: string
}

const paymentKind: Record<string, string> = { anticipo: 'Anticipo', saldo: 'Saldo', compenso: 'Compenso', altro: 'Altro' }

function show(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field && /date$/.test(field) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return String(value)
}

function euro(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : show(value)
}

/** Righe da mostrare: campo, valore attuale, valore proposto. */
export function proposalDiff(p: Pick<ProposalRow, 'kind' | 'payload' | 'current_values'>): DiffRow[] {
  const pl = p.payload ?? {}
  const cur = p.current_values ?? {}
  switch (p.kind) {
    case 'crea_corso':
      return COURSE_FIELDS.filter((f) => pl[f] !== undefined && pl[f] !== '').map((f) => ({
        label: courseFieldLabel[f],
        before: '—',
        after: show(pl[f], f),
      }))
    case 'aggiorna_corso': {
      const changes = (pl.changes ?? {}) as Record<string, unknown>
      return Object.keys(changes).map((f) => ({
        label: courseFieldLabel[f] ?? f,
        before: show(cur[f], f),
        after: show(changes[f], f),
      }))
    }
    case 'cambia_stato_corso':
      return [{ label: 'Stato', before: show(cur.status), after: show(pl.stato) }]
    case 'aggiungi_nota_corso':
      return [{ label: 'Nota da aggiungere', before: '', after: show(pl.nota) }]
    case 'registra_pagamento':
      return [
        { label: 'Movimento', before: '', after: pl.direzione === 'out' ? 'Pagamento al personale' : 'Incasso dalla Regione' },
        { label: 'Tipo', before: '', after: paymentKind[String(pl.tipo)] ?? show(pl.tipo) },
        { label: 'Importo', before: '', after: euro(pl.importo) },
        { label: 'Data', before: '', after: show(pl.data, 'data_date') },
        ...(pl.riferimento ? [{ label: 'Riferimento', before: '', after: show(pl.riferimento) }] : []),
      ]
    case 'allega_documento':
      return [
        { label: 'File', before: '', after: show(pl.file_name) },
        { label: 'Titolo', before: '', after: show(pl.titolo) },
      ]
    case 'aggiungi_lezione':
      return [
        { label: 'Lezione', before: '', after: show(pl.titolo) },
        { label: 'Inizio', before: '', after: show(pl.inizio) },
        { label: 'Fine', before: '', after: show(pl.fine) },
      ]
  }
}

/** Riga di nota datata in coda alle note del corso. */
export function appendDatedNote(existing: string | null | undefined, note: string, day = new Date().toISOString().slice(0, 10)): string {
  const line = `[${day}] ${note.trim()}`
  return existing?.trim() ? `${existing.trim()}\n${line}` : line
}
