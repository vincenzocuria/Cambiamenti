import { describe, expect, it } from 'vitest'
import { appendDatedNote, proposalAction, proposalDiff } from '../lib/proposals'

describe('proposte', () => {
  it('aggiorna_corso mostra valore attuale e proposto', () => {
    const rows = proposalDiff({
      kind: 'aggiorna_corso',
      payload: { changes: { cup: 'J34D26003310006', end_date: '2026-06-15' } },
      current_values: { cup: '', end_date: '2026-06-10' },
    })
    expect(rows).toEqual([
      { label: 'CUP', before: '—', after: 'J34D26003310006' },
      { label: 'Data fine', before: '10/06/2026', after: '15/06/2026' },
    ])
  })

  it('crea_corso elenca i campi del nuovo corso', () => {
    const rows = proposalDiff({ kind: 'crea_corso', payload: { name: 'Corso', edition: 'ED1 - 2026', code: '938.1' }, current_values: {} })
    expect(rows.map((r) => r.label)).toEqual(['Nome', 'Edizione', 'ID corso'])
  })

  it('registra_pagamento in euro', () => {
    const rows = proposalDiff({ kind: 'registra_pagamento', payload: { direzione: 'in', tipo: 'saldo', importo: 30971.5, data: '2026-08-03' }, current_values: {} })
    expect(rows.find((r) => r.label === 'Importo')!.after).toBe('€ 30.971,50')
    expect(rows.find((r) => r.label === 'Data')!.after).toBe('03/08/2026')
  })

  it('appendDatedNote', () => {
    expect(appendDatedNote('a', 'b', '2026-11-03')).toBe('a\n[2026-11-03] b')
  })
})

describe('proposalAction', () => {
  it('dice cosa succede accettando', () => {
    expect(proposalAction({ kind: 'aggiorna_corso', payload: { changes: { cup: 'J1' } } }, 'Eipass')).toBe('Se accetti, aggiorno CUP del corso «Eipass».')
    expect(proposalAction({ kind: 'allega_documento', payload: { file_name: 'a.pdf' } })).toBe('Se accetti, copio il file «a.pdf» nei documenti.')
  })
})
