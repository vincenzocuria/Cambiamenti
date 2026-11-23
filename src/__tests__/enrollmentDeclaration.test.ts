import { describe, expect, it } from 'vitest'
import { golTemplateSeeds } from '../data/golTemplates'
import { ENROLLMENT_DECLARATION_TEMPLATE } from '../data/golTemplates/dichiarazioneFrequenza'
import { PLACEHOLDER_RE, fillTemplate } from '../lib/fillTemplate'
import { buildTemplateContext } from '../lib/templateContext'
import type { Course, Person } from '../types/db'

const course = {
  name: 'Tecnico Informatico',
  edition: '',
  code: '',
  duration_hours: 500,
  funding_decree: 'n. 19978 del 20/11/2026',
} as unknown as Course

const person = {
  first_name: 'Anna',
  last_name: 'Verdi',
  gender: 'F',
  tax_code: 'VRDNNA90A41D005X',
  birth_place: 'Corigliano Calabro',
  birth_date: '1990-01-01',
  address: 'Via Nazionale 10',
  postal_code: '87064',
  city: 'Corigliano Rossano',
  province: 'CS',
  phone: '3330000000',
  email: '',
  inps_benefit: 'adi',
} as unknown as Person

const template = golTemplateSeeds.find((t) => t.name === ENROLLMENT_DECLARATION_TEMPLATE)!

describe('dichiarazione disponibilità frequenza', () => {
  it('fallback {{chiave|testo}} solo se il valore manca', () => {
    expect(fillTemplate('{{a|__}}-{{b|__}}-{{c}}', { a: 'x', b: '  ' })).toBe('x-__-')
  })

  it('è un modulo allievo del corso', () => {
    expect(template).toMatchObject({ person_role: 'student', requires_course: true, default_category: 'declaration' })
  })

  it('usa solo variabili note e si precompila con allievo e corso', () => {
    const vars = buildTemplateContext({ course, person, personType: 'student' })
    const keys = [...template.body.matchAll(PLACEHOLDER_RE)].map((m) => m[1])
    expect(keys.filter((k) => !(k in vars))).toEqual([])
    const filled = fillTemplate(template.body, vars)
    expect(filled).toContain('La sottoscritta Verdi Anna, nata a Corigliano Calabro')
    expect(filled).toContain('corso Tecnico Informatico della durata di 500 ore')
    expect(filled).toContain('Decreto Dirigenziale n. 19978 del 20/11/2026')
    expect(filled).toMatch(/☑ PERCETTORE ADI/)
    expect(filled).toMatch(/☐ PERCETTORE NASPI/)
    expect(filled).toContain('E-mail ____')
    expect(filled).toContain('cambiamentisrl@pec.it')
  })

  it('senza allievo resta un modulo in bianco', () => {
    const filled = fillTemplate(template.body, buildTemplateContext({ course }))
    expect(filled).toContain('Il/La sottoscritto/a ____')
    expect(filled).toContain('☐ NESSUNO')
  })
})
