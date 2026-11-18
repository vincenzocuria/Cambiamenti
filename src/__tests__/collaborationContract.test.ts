import { describe, expect, it } from 'vitest'
import { golTemplateSeeds } from '../data/golTemplates'
import {
  COCOCO_TEMPLATE_NAME,
  contractPhase,
  contractWarnings,
  emptyContract,
  rolesPhrase,
  rolesTitle,
  type ContractInput,
} from '../lib/collaborationContract'
import { fillTemplate } from '../lib/fillTemplate'
import { buildTemplateContext } from '../lib/templateContext'
import type { Person } from '../types/db'

const person = {
  first_name: 'Mario',
  last_name: 'Rossi',
  tax_code: 'RSSMRA80A01H501U',
  birth_place: 'Roma',
  birth_date: '1980-01-01',
  address: 'Via Roma 1',
  postal_code: '87064',
  city: 'Corigliano Rossano',
  province: 'CS',
  gender: 'M',
} as unknown as Person

const contract: ContractInput = {
  ...emptyContract('p1'),
  role_tutor: true,
  role_direction: false,
  role_admin: true,
  courses_text: 'EIPASS 7 – SKILLS FOR GREEN',
  start_date: '2025-11-01',
  end_date: '2026-12-31',
  gross_amount: 14094.3,
  notice_days: 30,
}

const template = golTemplateSeeds.find((t) => t.name === COCOCO_TEMPLATE_NAME)!

describe('contratto co.co.co.', () => {
  it('descrive le attività come nel contratto firmato', () => {
    expect(rolesTitle({ role_tutor: true, role_direction: true, role_admin: true })).toBe('Tutor e Direzione/Amministrazione')
    expect(rolesPhrase({ role_tutor: true, role_direction: true, role_admin: true })).toBe(
      'Tutor nonché Direzione e Amministrazione',
    )
    expect(rolesPhrase({ role_tutor: true, role_direction: false, role_admin: true })).toBe('Tutor nonché Amministrazione')
  })

  it('il modello usa solo variabili note e compila i dati del contratto', () => {
    const vars = buildTemplateContext({ person, personType: 'staff', contract })
    const keys = [...template.body.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((m) => m[1])
    expect(keys.filter((k) => !(k in vars))).toEqual([])
    const filled = fillTemplate(template.body, vars)
    expect(filled).toContain('RSSMRA80A01H501U')
    expect(filled).toContain('decorre dal 01/11/2025 e avrà termine il 31/12/2026')
    expect(filled).toContain('€ 14.094,30 (QUATTORDICIMILANOVANTAQUATTRO,30)')
    expect(filled).toContain('almeno 30 giorni')
    expect(filled).toContain('A) Attività di tutoraggio')
    expect(filled).toContain('B) Attività di amministrazione del corso')
    expect(filled).not.toContain('Attività di direzione del corso')
    expect(filled).not.toMatch(/\[[A-Z ]+\]/)
  })

  it('senza contratto lascia righe da compilare', () => {
    const filled = fillTemplate(template.body, buildTemplateContext({ person, personType: 'staff' }))
    expect(filled).toContain('almeno ____ giorni')
  })

  it('segnala i dati mancanti', () => {
    expect(contractWarnings(contract)).toEqual([])
    expect(contractWarnings({ ...contract, notice_days: null, gross_amount: null })).toHaveLength(2)
  })

  it('calcola la fase del contratto', () => {
    expect(contractPhase({ ...contract, status: 'firmato' }, '2026-11-18')).toBe('in_scadenza')
    expect(contractPhase({ ...contract, status: 'firmato' }, '2026-06-01')).toBe('in_corso')
    expect(contractPhase({ ...contract, status: 'firmato' }, '2027-01-02')).toBe('scaduto')
    expect(contractPhase({ ...contract, status: 'firmato' }, '2025-10-01')).toBe('futuro')
  })
})
