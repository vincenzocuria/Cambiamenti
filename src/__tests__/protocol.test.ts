import { describe, expect, it } from 'vitest'
import { filterProtocol, nextNumber, numberingGaps, protocolLabel, sortProtocol, type ProtocolEntry } from '../lib/protocol'

function entry(year: number, number: number, extra: Partial<ProtocolEntry> = {}): ProtocolEntry {
  return {
    id: `${year}-${number}`,
    year,
    number,
    entry_date: `${year}-01-10`,
    direction: 'uscita',
    counterpart: 'Regione Calabria',
    subject: 'Comunicazione',
    channel: 'PEC',
    external_ref: '',
    notes: '',
    course_id: null,
    document_id: null,
    pec_message_id: null,
    cancelled_at: null,
    cancelled_reason: '',
    created_at: '',
    course: null,
    ...extra,
  }
}

describe('registro di protocollo', () => {
  it('numera per anno e riparte da 1', () => {
    const list = [entry(2026, 1), entry(2026, 2), entry(2026, 5)]
    expect(nextNumber(list, 2026)).toBe(6)
    expect(nextNumber(list, 2027)).toBe(1)
    expect(protocolLabel({ number: 1, year: 2027 })).toBe('1/2027')
  })

  it('segnala i numeri saltati', () => {
    expect(numberingGaps([entry(2026, 1), entry(2026, 4)], 2026)).toEqual([2, 3])
    expect(numberingGaps([], 2026)).toEqual([])
  })

  it('filtra per anno, tipo e testo (anche sul numero e sul corso)', () => {
    const list = [
      entry(2026, 1, { subject: 'Variazione allievi', course: { id: 'c', name: 'Skills', code: '938.1', edition: 'ED1' } }),
      entry(2026, 2, { direction: 'entrata', subject: 'Nota Regione' }),
      entry(2027, 1),
    ]
    expect(filterProtocol(list, { year: 2026, direction: 'tutte', query: '' })).toHaveLength(2)
    expect(filterProtocol(list, { year: 'tutti', direction: 'entrata', query: '' }).map((e) => e.id)).toEqual(['2026-2'])
    expect(filterProtocol(list, { year: 'tutti', direction: 'tutte', query: '938.1 variazione' }).map((e) => e.id)).toEqual(['2026-1'])
    expect(filterProtocol(list, { year: 'tutti', direction: 'tutte', query: '1/2027' }).map((e) => e.id)).toEqual(['2027-1'])
  })

  it('ordina dal più recente', () => {
    expect(sortProtocol([entry(2026, 3), entry(2027, 1), entry(2026, 9)]).map((e) => e.id)).toEqual(['2027-1', '2026-9', '2026-3'])
  })
})
