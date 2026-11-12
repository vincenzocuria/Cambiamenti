import { describe, expect, it } from 'vitest'
import { courseTitle, editionNumber, regionAddressFor, variationLetterHtml, variationSentence } from '../lib/studentVariationLetter'
import type { Course, Person } from '../types/db'

const person = {
  id: 's1',
  first_name: 'Natale',
  last_name: 'Scarpello',
  tax_code: 'SCRNTL92T28D005F',
  gender: 'M',
  birth_date: '1992-12-28',
  birth_place: 'Corigliano Calabro (CS)',
} as Person
const course = { id: 'c1', name: 'Formazione per la creazione di impresa', code: '938.1', edition: 'ED2 - 2025', cup: '', funding_program: '', funding_decree: '' } as Course

describe('comunicazione variazione allievi', () => {
  it('ricava edizione e titolo del percorso', () => {
    expect(editionNumber('ED2 - 2025')).toBe('2')
    expect(courseTitle(course)).toBe('PERCORSO FORMATIVO “Formazione per la creazione di impresa” COD./ID N 938.1 EDIZIONE 2')
  })

  it('scrive la frase del trasferimento con il corso di arrivo', () => {
    const s = variationSentence({
      person,
      kind: 'trasferimento_uscita',
      day: '2025-12-06',
      note: '',
      otherCourse: { name: course.name, code: '938.1', edition: 'ED1 - 2025' },
    })
    expect(s).toContain('SCARPELLO NATALE')
    expect(s).toContain('trasferito, a decorrere dal 06/12/2025')
    expect(s).toContain('EDIZIONE 1')
  })

  it('usa l’avviso giusto e allega il Mod. 1/B', () => {
    const address = regionAddressFor(course)
    expect(address.subjectPrefix).toContain('Avviso Pubblico n. 4')
    expect(regionAddressFor({ ...course, code: '474' }).pecTo).toContain('dipartimento.lavoro.imprese')
    const html = variationLetterHtml({
      course,
      variations: [{ person, kind: 'ritiro', day: '2025-12-06', note: 'motivi personali', otherCourse: null }],
      students: [person],
      protocol: '25',
      date: '2025-12-06',
      address,
      logoUrl: '/logo.png',
    })
    expect(html).toContain('Prot. 25 del 06/12/2025')
    expect(html).toContain('Mod. 1/B')
    expect(html).toContain('SCRNTL92T28D005F')
  })
})
