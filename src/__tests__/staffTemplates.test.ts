import { describe, expect, it } from 'vitest'
import { golTemplateSeeds } from '../data/golTemplates'
import { fillTemplate } from '../lib/fillTemplate'
import { buildTemplateContext } from '../lib/templateContext'
import type { Course, Person, PersonType } from '../types/db'

const course = {
  name: 'Formazione Per La Creazione Di Impresa',
  edition: 'ED1 - 2025',
  code: '938.1',
  cup: 'J00X00000000000',
  notes: '',
  status: 'in_creazione',
  start_date: null,
  end_date: null,
  duration_hours: 80,
} as unknown as Course

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
  email: 'mario@example.com',
} as unknown as Person

const staffSeeds = golTemplateSeeds.filter((t) => t.person_role !== 'student')

describe('template personale di corso', () => {
  it('ha nomi univoci', () => {
    const names = golTemplateSeeds.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('copre docenti, tutor e amministrativi', () => {
    expect(staffSeeds.map((t) => t.person_role).sort()).toEqual([
      'admin_staff',
      'teacher',
      'teacher',
      'tutor',
    ])
  })

  it.each(staffSeeds.map((t) => [t.name, t] as const))('%s usa solo variabili note', (_name, t) => {
    const vars = buildTemplateContext({ course, person, personType: t.person_role as PersonType })
    const keys = [...t.body.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((m) => m[1])
    expect(keys.filter((k) => !(k in vars))).toEqual([])
    const filled = fillTemplate(t.body, vars)
    expect(filled).toContain('RSSMRA80A01H501U')
    expect(filled).toContain('938.1')
  })
})
