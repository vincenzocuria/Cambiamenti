// Iter di un corso dal bando alla chiusura: cosa c'è già e cosa manca.

export type IterState = 'fatto' | 'manca' | 'in_attesa' | 'facoltativo'

export interface IterStep {
  fase: string
  stato: IterState
  dettaglio: string
}

export interface IterInput {
  status: string
  cup: string | null
  code: string | null
  funding_program: string | null
  funding_decree: string | null
  start_date: string | null
  end_date: string | null
  duration_hours: number | null
  staff: number
  students: number
  lessons: number
  reportLines: number
  /** Saldo del verbale ancora da incassare (null se non c'è verbale). */
  balanceToReceive: number | null
  documents: number
}

const ORDER = ['bozza', 'in_creazione', 'in_attivazione', 'in_corso', 'finito', 'rendicontato', 'esito_chiuso']

function atLeast(status: string, target: string): boolean {
  return ORDER.indexOf(status) >= ORDER.indexOf(target)
}

export function courseIter(c: IterInput, now = new Date().toISOString().slice(0, 10)): { fasi: IterStep[]; prossimo_passo: string } {
  const fasi: IterStep[] = []
  const add = (fase: string, ok: boolean, okText: string, koText: string, waiting = false) =>
    fasi.push({ fase, stato: ok ? 'fatto' : waiting ? 'in_attesa' : 'manca', dettaglio: ok ? okText : koText })

  add(
    'Bando e finanziamento',
    Boolean(c.funding_program || c.funding_decree),
    [c.funding_program, c.funding_decree].filter(Boolean).join(' · '),
    'Programma/avviso e decreto di finanziamento non indicati',
  )
  const missing = [!c.code && 'ID corso', !c.start_date && 'data inizio', !c.end_date && 'data fine', !c.duration_hours && 'ore'].filter(Boolean)
  add('Dati del corso', missing.length === 0, 'ID, date e ore presenti', `Mancano: ${missing.join(', ')}`)
  fasi.push({
    fase: 'CUP',
    stato: c.cup ? 'fatto' : 'facoltativo',
    dettaglio: c.cup ? c.cup : 'Non indicato (non sempre previsto)',
  })
  add('Organico (docenti, tutor, amministrativi)', c.staff > 0, `${c.staff} incarichi`, 'Nessun incarico registrato')
  add('Allievi iscritti', c.students > 0, `${c.students} allievi`, 'Nessun allievo collegato')
  add('Calendario lezioni', c.lessons > 0, `${c.lessons} lezioni`, 'Nessuna lezione in calendario')

  const started = c.start_date ? c.start_date <= now : false
  const ended = c.end_date ? c.end_date < now : false
  add(
    'Svolgimento',
    atLeast(c.status, 'finito') || ended,
    ended ? `Lezioni concluse il ${c.end_date}` : 'Concluso',
    started ? 'In svolgimento' : 'Non ancora iniziato',
    !started || !ended,
  )
  add(
    'Rendicontazione / verbale Regione',
    c.reportLines > 0 || atLeast(c.status, 'rendicontato'),
    c.reportLines > 0 ? `${c.reportLines} righe di verbale caricate` : 'Stato rendicontato',
    atLeast(c.status, 'finito') ? 'Verbale della Regione non ancora caricato' : 'Dopo la fine del corso',
    !atLeast(c.status, 'finito'),
  )
  add(
    'Incasso saldo',
    c.balanceToReceive !== null && c.balanceToReceive <= 0,
    'Saldo del verbale incassato',
    c.balanceToReceive === null ? 'Serve prima il verbale' : `Da incassare € ${c.balanceToReceive.toFixed(2)}`,
    c.balanceToReceive === null,
  )
  add('Chiusura (esito chiuso)', c.status === 'esito_chiuso', 'Ciclo chiuso', 'Non ancora chiuso', true)

  const next = fasi.find((f) => f.stato === 'manca') ?? fasi.find((f) => f.stato === 'in_attesa')
  return { fasi, prossimo_passo: next ? `${next.fase}: ${next.dettaglio}` : 'Nessuno: iter completo' }
}
