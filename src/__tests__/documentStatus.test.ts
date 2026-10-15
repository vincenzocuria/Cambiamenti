import { describe, expect, it } from 'vitest'
import {
  checkPersonDocuments,
  checkStaffDocuments,
  studentDocumentStatusLabel,
} from '../lib/studentDocumentStatus'
import { countPersonStatuses, matchesPersonStatus } from '../lib/personListStatus'
import type { Person } from '../types/db'

const base = {
  doc_type: "Carta d'identità",
  doc_number: 'CA12345',
  doc_expiry_date: '2099-01-01',
}

function person(id: string, extra: Partial<Person> = {}): Person {
  return { id, first_name: 'A', last_name: 'B', ...base, ...extra } as Person
}

describe('documenti ok del personale', () => {
  it('è ok con identità completa e curriculum', () => {
    const check = checkStaffDocuments(base, true, true, '2026-10-15')
    expect(check.ok).toBe(true)
    expect(studentDocumentStatusLabel(check)).toBe('Documenti ok')
  })

  it('senza curriculum risultano documenti mancanti', () => {
    const check = checkStaffDocuments(base, true, false, '2026-10-15')
    expect(check.gaps).toEqual(['curriculum'])
    expect(studentDocumentStatusLabel(check)).toBe('Documenti mancanti')
  })

  it('documento scaduto anche con curriculum', () => {
    const check = checkStaffDocuments({ ...base, doc_expiry_date: '2020-01-01' }, true, true, '2026-10-15')
    expect(studentDocumentStatusLabel(check)).toBe('Documento scaduto')
  })

  it('il contesto con curriculum attiva il controllo del personale', () => {
    const ctx = { hasIdentityFile: () => true, hasCurriculumFile: (id: string) => id === 'cv' }
    expect(checkPersonDocuments(person('cv'), ctx).ok).toBe(true)
    expect(checkPersonDocuments(person('nocv'), ctx).ok).toBe(false)
    // Alunni: nessun controllo curriculum
    expect(checkPersonDocuments(person('nocv'), { hasIdentityFile: () => true }).ok).toBe(true)
  })

  it('filtri e contatori dell’elenco personale', () => {
    const people = [person('cv'), person('nocv')]
    const ctx = { hasIdentityFile: () => true, hasCurriculumFile: (id: string) => id === 'cv' }
    expect(people.filter((p) => matchesPersonStatus(p, 'documenti_ok', ctx)).map((p) => p.id)).toEqual(['cv'])
    const counts = countPersonStatuses(people, ctx)
    expect(counts.documenti_ok).toBe(1)
    expect(counts.documenti_mancanti).toBe(1)
  })
})
