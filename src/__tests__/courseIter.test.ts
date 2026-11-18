import { describe, expect, it } from 'vitest'
import {
  defaultDue,
  evaluateIter,
  guessIterModel,
  iterRows,
  stepDef,
  summarizeIter,
  type CourseStep,
  type IterFacts,
} from '../lib/courseIter'

const facts = (over: Partial<IterFacts> = {}): IterFacts => ({
  status: 'in_corso',
  code: '673.7',
  cup: null,
  fundingProgram: 'GOL',
  fundingDecree: null,
  startDate: '2026-10-01',
  endDate: '2026-12-15',
  durationHours: 120,
  staff: 0,
  students: 0,
  lessons: 0,
  fadDays: 0,
  reportLines: 0,
  invoices: [],
  documents: [],
  ...over,
})

function steps(model: 'gol' | 'standard'): CourseStep[] {
  return iterRows(model, 'c1', '2026-10-01', '2026-12-15').map((r, i) => ({
    id: `s${i}`,
    course_id: 'c1',
    step_key: r.step_key,
    sort_order: r.sort_order,
    title: r.title,
    status: 'da_fare',
    due_on: r.due_on,
    done_on: null,
    notes: '',
    manual: false,
    created_at: '2026-11-18T00:00:00Z',
    updated_at: '2026-11-18T00:00:00Z',
  }))
}

describe('iter del corso', () => {
  it('modello GOL proposto dal programma o dal nome; i passi GOL solo nel modello GOL', () => {
    expect(guessIterModel({ funding_program: 'Programma GOL' })).toBe('gol')
    expect(guessIterModel({ name: 'Garanzia di Occupabilità dei Lavoratori' })).toBe('gol')
    expect(guessIterModel({ funding_program: 'Skills for Green' })).toBe('standard')
    const gol = steps('gol').map((s) => s.step_key)
    const std = steps('standard').map((s) => s.step_key)
    expect(gol).toContain('autodichiarazione')
    expect(gol).toContain('nota_debito_indennita')
    expect(std).not.toContain('autodichiarazione')
    expect(std).toContain('nota_debito_saldo')
  })

  it('scadenze proposte dalle date del corso', () => {
    expect(defaultDue(stepDef('dati_corso'), '2026-10-01', '2026-12-15')).toBe('2026-09-24')
    expect(defaultDue(stepDef('presenze'), '2026-10-01', '2026-12-15')).toBe('2026-12-22')
    expect(defaultDue(stepDef('verbale'), '2026-10-01', '2026-12-15')).toBeNull()
    expect(defaultDue(stepDef('presenze'), null, null)).toBeNull()
  })

  it('i passi verificabili si spuntano dai dati; il prossimo passo è il primo aperto', () => {
    const ev = evaluateIter(steps('gol'), facts({ fundingDecree: '11091/2026', staff: 3, students: 12 }), new Map(), '2026-11-18')
    const by = Object.fromEntries(ev.map((e) => [e.step.step_key, e]))
    expect(by.decreto.state).toBe('fatto')
    expect(by.decreto.autoDone).toBe(true)
    expect(by.dati_corso.state).toBe('fatto')
    expect(by.organico.evidence).toBe('3 incarichi')
    expect(by.allievi.state).toBe('fatto')
    expect(by.calendario.state).toBe('da_fare')
    const sum = summarizeIter(ev)
    expect(sum.next?.step.step_key).toBe('adesione')
  })

  it('documenti: riconosciuti dal nome o collegati al passo', () => {
    const docs = [
      { id: 'd1', title: 'PEC comunicazione avvio corso', file_name: 'avvio.pdf', category: 'other' },
      { id: 'd2', title: 'Allegato', file_name: 'All_1_Autodichiarazione_CONDIZIONALITA.pdf.p7m', category: 'declaration' },
      { id: 'd3', title: 'Ricevuta', file_name: 'ricevuta.pdf', category: 'other' },
    ]
    const s = steps('gol')
    const adesione = s.find((x) => x.step_key === 'adesione')!
    const ev = evaluateIter(s, facts({ documents: docs }), new Map([[adesione.id, ['d3']]]), '2026-11-18')
    const by = Object.fromEntries(ev.map((e) => [e.step.step_key, e]))
    expect(by.comunicazione_avvio.state).toBe('fatto')
    expect(by.comunicazione_avvio.documentIds).toEqual(['d1'])
    expect(by.autodichiarazione.state).toBe('fatto')
    expect(by.adesione.evidence).toBe('Documento caricato')
    expect(by.controfirma_verbale.state).toBe('da_fare')
  })

  it('note di debito e incassi: emessa ≠ pagata; le bozze non contano', () => {
    const ev = evaluateIter(
      steps('gol'),
      facts({ reportLines: 1, invoices: [{ kind: 'balance', paid: true }, { kind: 'allowance', paid: false }] }),
      new Map(),
      '2026-11-18',
    )
    const by = Object.fromEntries(ev.map((e) => [e.step.step_key, e]))
    expect(by.verbale.state).toBe('fatto')
    expect(by.nota_debito_saldo.state).toBe('fatto')
    expect(by.incasso_saldo.state).toBe('fatto')
    expect(by.nota_debito_indennita.state).toBe('fatto')
    expect(by.incasso_indennita.state).toBe('da_fare')
  })

  it('stato segnato a mano vince; ritardi solo sui passi aperti', () => {
    const s = steps('standard')
    s.find((x) => x.step_key === 'adesione')!.status = 'non_applicabile'
    s.find((x) => x.step_key === 'esami_attestati')!.status = 'fatto'
    const ev = evaluateIter(s, facts({ endDate: '2026-10-15' }), new Map(), '2026-11-18')
    const by = Object.fromEntries(ev.map((e) => [e.step.step_key, e]))
    expect(by.adesione.state).toBe('non_applicabile')
    expect(by.esami_attestati.state).toBe('fatto')
    expect(by.svolgimento.state).toBe('fatto')
    expect(by.calendario.overdue).toBe(true)
    const sum = summarizeIter(ev)
    expect(sum.total).toBe(ev.length - 1)
    expect(sum.overdue.map((e) => e.step.step_key)).toContain('calendario')
  })

  it('stato a mano: un passo riconosciuto per errore resta da fare', () => {
    const s = steps('gol')
    const avvio = s.find((x) => x.step_key === 'comunicazione_avvio')!
    avvio.manual = true
    const docs = [{ id: 'd1', title: 'Calendario avvio', file_name: 'x.pdf', category: 'other' }]
    const ev = evaluateIter(s, facts({ documents: docs }), new Map(), '2026-11-18')
    expect(ev.find((e) => e.step.step_key === 'comunicazione_avvio')!.state).toBe('da_fare')
  })

  it('note di debito solo dopo il verbale: non sono il prossimo passo prima', () => {
    const s = steps('gol')
    for (const x of s) if (!['nota_debito_saldo', 'verbale', 'controfirma_verbale', 'autodichiarazione', 'nota_debito_indennita', 'incasso_saldo', 'incasso_indennita', 'chiusura', 'rendiconto'].includes(x.step_key!)) x.status = 'fatto'
    const ev = evaluateIter(s, facts(), new Map(), '2026-11-18')
    const nd = ev.find((e) => e.step.step_key === 'nota_debito_saldo')!
    expect(nd.blockedBy).toContain('Verbale di verifica della Regione')
    expect(summarizeIter(ev).next?.step.step_key).toBe('rendiconto')
  })
})
