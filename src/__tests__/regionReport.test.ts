import { describe, expect, it } from 'vitest'
import type { Course } from '../types/db'
import {
  courseEditionNumber,
  coursesWithCups,
  dateMismatches,
  matchReportRow,
  parseEuro,
  parseRegionReport,
  suggestedTitle,
} from '../lib/regionReport'
import { linesFromItems } from '../lib/pdfText'

// Righe come escono da pdf.js per il verbale di verifica finale GOL (Prot. 857399)
const VERBALE = [
  'Prot. N. 857399 del 21/10/2026',
  'OGGETTO: Avviso Pubblico n.2 GOL -Programma Garanzia Occupabilità dei Lavoratori da finanziare nell’ambito del Piano',
  'Riforma 1.1 “Politiche Attive del Lavoro e Formazione”. D.D.G. N. 12439 del 17/10/2022 – Burc n. 234 del 20/10/2022.',
  'VERIFICA FINALE AMMINISTRATIVA CONTABILE PROGETTI FORMATIVI',
  'CUP  TITOLO CORSO  EDIZIONE  FINANZIAMENTO  ORE',
  'TOTALE',
  'Corigliano-Rossano -  180',
  'J32E22001120001  673.7  EIPASS 7 Moduli User  ED. 2  € 26.123,40',
  'J32E22001120001  673.6  EIPASS Progressive  ED. 1  € 21.769,50',
  'J32E22001120001  180  -  14  ID 524  10/11/2025  16/12/2025',
  'J32E22001120001  150  -  14  ID 382  03/11/2025  05/12/2025',
  'PREVENTIVO  RICONOSCIUTO  ANTICIPAZIONE  ANTICIPAZIONE  LIQUIDARE',
  'J32E22001120001  € 26.123,40  € 25.848,80  -  -  € 25.849,80',
  'J32E22001120001  € 21.769,50  € 21.616,50  -  -  € 21.616,50',
  'TOTALE',
  '€ 47.466,30',
]

const course = (over: Partial<Course>): Course => ({
  id: 'x',
  name: '',
  edition: '',
  code: '',
  cup: '',
  notes: '',
  status: 'active' as Course['status'],
  start_date: null,
  end_date: null,
  duration_hours: null,
  funding_decree: '',
  funding_program: '',
  moodle_course_id: null,
  moodle_bbb_id: null,
  moodle_shortname: '',
  created_at: '',
  updated_at: '',
  ...over,
})

const COURSES = [
  course({ id: 'p1', name: 'Eipass Progressive', edition: 'ED1 - 2025', code: '673.6', cup: 'J32E22001120001', start_date: '2025-11-03', end_date: '2025-12-05' }),
  course({ id: 'p2', name: 'Eipass Progressive', edition: 'ED2 - 2025', code: '673.6', cup: 'J32E22001120001', start_date: '2025-11-03', end_date: '2025-11-05' }),
  course({ id: 'u1', name: 'Eipass 7 Moduli User', edition: 'ED1 - 2025', code: '673.7', cup: 'J32E22001120001' }),
  course({ id: 'u2', name: 'Eipass 7 Moduli User', edition: 'ED2 - 2025', code: '673.7', cup: 'J32E22001120001', start_date: '2025-11-10', end_date: '2025-12-16' }),
  course({ id: 'z', name: 'Altro', edition: '1', code: '999.1', cup: 'B11B11111111111' }),
]

describe('verbali della Regione', () => {
  it('importi e date', () => {
    expect(parseEuro('€ 26.123,40')).toBe(26123.4)
    expect(parseEuro('-')).toBeNull()
  })

  it('legge protocollo, corsi, ore, allievi e importi', () => {
    const r = parseRegionReport(VERBALE)
    expect(r.kind).toBe('report')
    expect(r.protocolNumber).toBe('857399')
    expect(r.protocolDate).toBe('2026-10-21')
    expect(r.subject).toBe('VERIFICA FINALE AMMINISTRATIVA CONTABILE PROGETTI FORMATIVI')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({
      courseCode: '673.7',
      title: 'EIPASS 7 Moduli User',
      edition: 2,
      studentsTrained: 14,
      membershipAct: 'ID 524',
      startDate: '2025-11-10',
      endDate: '2025-12-16',
      budget: 26123.4,
      recognized: 25848.8,
      advance: null,
      balance: 25849.8,
    })
    expect(r.total).toBe(47466.3)
    expect(suggestedTitle(r, 'v.pdf.p7m')).toBe(
      'Verbale verifica finale amministrativa contabile progetti formativi – Prot. 857399 del 21/10/2026',
    )
  })

  it('segnala il saldo che non torna col riconosciuto', () => {
    const r = parseRegionReport(VERBALE)
    expect(r.warnings).toEqual(['673.7 ED. 2: riconosciuto € 25.848,80 ma saldo da liquidare € 25.849,80.'])
  })

  it('segnala righe mancanti', () => {
    const r = parseRegionReport(VERBALE.filter((l) => !l.includes('ID 382')))
    expect(r.warnings.some((w) => w.includes('ore e date'))).toBe(true)
    expect(r.rows[1].startDate).toBeNull()
  })

  it('abbina i corsi del gestionale per CUP, ID corso ed edizione', () => {
    const r = parseRegionReport(VERBALE)
    expect(r.rows.map((row) => matchReportRow(row, COURSES)?.id)).toEqual(['u2', 'p1'])
    expect(courseEditionNumber('ED1 - 2025')).toBe(1)
    expect(courseEditionNumber('Ed. 3')).toBe(3)
    expect(courseEditionNumber('2')).toBe(2)
  })

  it('nessun abbinamento se il corso non c\'è', () => {
    const r = parseRegionReport(VERBALE)
    expect(matchReportRow(r.rows[0], COURSES.filter((c) => c.id !== 'u2'))).toBeNull()
  })

  it('segnala le date diverse dalla scheda corso', () => {
    const row = { ...parseRegionReport(VERBALE).rows[1], endDate: '2025-12-05' }
    expect(dateMismatches(row, COURSES[1])).toEqual(['fine: verbale 05/12/2025, gestionale 05/11/2025'])
  })
})

describe('autodichiarazioni', () => {
  const LINES = [
    'Allegato 1 – Autodichiarazione relativa al rispetto della normativa vigente in materia di',
    'condizionalità relativi ai beneficiari percettori di sostegno al reddito',
    'DICHIARA SOTTO LA PROPRIA RESPONSABILITÀ',
    'codice/i CUP J32E22001120001 ha provveduto a rispettare tutti gli obblighi',
  ]

  it('riconosce il tipo e propone i corsi col CUP', () => {
    const r = parseRegionReport(LINES)
    expect(r.kind).toBe('declaration')
    expect(r.rows).toHaveLength(0)
    expect(r.cups).toEqual(['J32E22001120001'])
    expect(r.subject.startsWith('Autodichiarazione relativa')).toBe(true)
    expect(r.subject.endsWith('sostegno al reddito')).toBe(true)
    expect(coursesWithCups(r.cups, COURSES).map((c) => c.id)).toEqual(['p1', 'p2', 'u1', 'u2'])
  })
})

describe('testo dal PDF', () => {
  it('unisce i pezzi per riga e separa le celle con due spazi', () => {
    const item = (str: string, x: number, y: number, width: number) => ({ str, transform: [1, 0, 0, 1, x, y], width })
    expect(
      linesFromItems([
        item('673.7', 200, 500, 20),
        item('J32E22001120001', 100, 501, 60),
        item('EIPASS', 260, 500, 30),
        item('7', 292, 500, 4),
        item('Prot.', 100, 700, 20),
      ]),
    ).toEqual(['Prot.', 'J32E22001120001  673.7  EIPASS 7'])
  })
})
