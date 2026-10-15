import { describe, expect, it } from 'vitest'
import { euroInWords, formatEuro, numberInWords } from '../lib/euroInWords'
import { golTemplateSeeds } from '../data/golTemplates'
import { fillTemplate } from '../lib/fillTemplate'
import { buildTemplateContext } from '../lib/templateContext'
import type { Course, Person } from '../types/db'

describe('importi in lettere', () => {
  it.each([
    [2000, 'duemila'],
    [21, 'ventuno'],
    [188, 'centottantotto'],
    [1250, 'milleduecentocinquanta'],
    [35000, 'trentacinquemila'],
  ])('%d → %s', (n, words) => expect(numberInWords(n)).toBe(words))

  it('formatta come nei contratti', () => {
    expect(euroInWords(2000)).toBe('DUEMILA,00')
    expect(formatEuro(2000)).toBe('2.000,00')
    expect(formatEuro(25)).toBe('25,00')
  })
})

describe('lettera di incarico', () => {
  const letter = golTemplateSeeds.find((t) => t.name === 'Lettera di incarico docente')!
  const course = {
    name: 'Operatore Segreteria',
    edition: '6',
    code: '20.5',
    cup: 'J54D22009130006',
    funding_decree: 'n. 12595 del 08/09/2025',
    funding_program: '',
  } as unknown as Course
  const person = { first_name: 'Anna', last_name: 'Rossi', gender: 'F', tax_code: 'X' } as unknown as Person

  it('usa moduli, ore e compenso dell’incarico', () => {
    const text = fillTemplate(
      letter.body,
      buildTemplateContext({
        course,
        person,
        personType: 'teacher',
        assignment: { role: 'teacher', modules: 'ACCOGLIENZA', hours: 80, hourly_rate: 25 },
      }),
    )
    expect(text).toContain('moduli: ACCOGLIENZA')
    expect(text).toContain('per n. 80 ore')
    expect(text).toContain('€ 2.000,00 lordi (euro DUEMILA,00)')
    expect(text).toContain('Decreto n. 12595 del 08/09/2025')
    expect(text).toContain('nata a')
  })

  it('lascia righe da compilare se l’incarico non è indicato', () => {
    const text = fillTemplate(letter.body, buildTemplateContext({ course, person, personType: 'teacher' }))
    expect(text).toContain('per n. ______ ore')
  })
})
