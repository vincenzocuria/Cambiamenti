import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  certificateLabel,
  filterCertificates,
  filterQualityDocuments,
  fmtScore,
  qualityProgress,
  reviewOverdue,
  studentsWithoutCertificate,
  summarizeResponses,
  surveyQuestionIds,
  unansweredQuestions,
  type Certificate,
  type QualityDocument,
} from '../lib/quality'
import { buildZip, crc32, safeZipName, uniquePaths } from '../lib/zip'
import { buildDossierIndex, dossierChecks, type DossierData } from '../lib/courseDossier'

const doc = (over: Partial<QualityDocument>): QualityDocument => ({
  id: 'd',
  code: 'PQ-01',
  title: 'Politica per la Qualità',
  origin: 'interno',
  area: 'direzione',
  iso_clause: '5.2',
  status: 'da_predisporre',
  revision: '',
  issued_on: null,
  review_due_on: null,
  owner: '',
  location: '',
  notes: '',
  file_name: '',
  storage_path: null,
  mime_type: '',
  size_bytes: 0,
  sort_order: 0,
  created_at: '',
  updated_at: '',
  ...over,
})

const cert = (over: Partial<Certificate>): Certificate => ({
  id: 'c',
  year: 2026,
  number: 1,
  issued_on: '2026-11-16',
  course_id: 'k',
  student_id: 's1',
  holder_name: 'Rossi Mario',
  holder_tax_code: 'RSSMRA',
  title: 'Attestato di frequenza',
  hours: 40,
  outcome: '',
  delivered_on: null,
  delivery_method: '',
  document_id: null,
  notes: '',
  cancelled_at: null,
  cancelled_reason: '',
  created_at: '',
  ...over,
})

describe('elenco master', () => {
  it('conta vigenti, mancanti e riesami scaduti, senza i superati', () => {
    const docs = [
      doc({ id: '1', status: 'vigente', review_due_on: '2026-01-01' }),
      doc({ id: '2', status: 'vigente', review_due_on: '2027-01-01' }),
      doc({ id: '3', status: 'bozza' }),
      doc({ id: '4' }),
      doc({ id: '5', status: 'superato' }),
    ]
    expect(qualityProgress(docs, '2026-11-16')).toEqual({ total: 4, ready: 2, draft: 1, missing: 1, overdue: 1 })
    expect(reviewOverdue(docs[0], '2026-11-16')).toBe(true)
    expect(reviewOverdue(doc({ status: 'bozza', review_due_on: '2020-01-01' }), '2026-11-16')).toBe(false)
  })

  it('il filtro «mancanti» tiene bozze e da predisporre', () => {
    const docs = [doc({ id: '1', status: 'vigente' }), doc({ id: '2', status: 'bozza' }), doc({ id: '3' })]
    expect(filterQualityDocuments(docs, { area: 'tutte', status: 'mancanti', query: '' }).map((d) => d.id)).toEqual(['2', '3'])
    expect(filterQualityDocuments(docs, { area: 'risorse', status: 'tutti', query: '' })).toEqual([])
    expect(filterQualityDocuments(docs, { area: 'tutte', status: 'tutti', query: 'pq-01 politica' })).toHaveLength(3)
  })
})

describe('registro attestati', () => {
  it('numero N/anno e filtri di consegna', () => {
    const list = [
      cert({ id: 'a', number: 1, delivered_on: '2026-11-20' }),
      cert({ id: 'b', number: 2 }),
      cert({ id: 'c', number: 3, cancelled_at: '2026-11-17', cancelled_reason: 'errore' }),
    ]
    expect(certificateLabel(list[1])).toBe('2/2026')
    const ids = (delivery: 'tutti' | 'consegnati' | 'da_consegnare' | 'annullati') =>
      filterCertificates(list, { year: 'tutti', delivery, query: '' }).map((c) => c.id)
    expect(ids('consegnati')).toEqual(['a'])
    expect(ids('da_consegnare')).toEqual(['b'])
    expect(ids('annullati')).toEqual(['c'])
    expect(filterCertificates(list, { year: 2025, delivery: 'tutti', query: '' })).toEqual([])
  })

  it('non rilascia due volte lo stesso attestato, ma sì dopo un annullamento', () => {
    const list = [cert({ student_id: 's1' }), cert({ student_id: 's2', cancelled_at: 'x' })]
    expect(studentsWithoutCertificate(['s1', 's2', 's3'], list, 'Attestato di frequenza')).toEqual(['s2', 's3'])
    expect(studentsWithoutCertificate(['s1'], list, 'Attestato di qualifica')).toEqual(['s1'])
  })
})

describe('questionari', () => {
  it('le domande coincidono con quelle accettate dal database', () => {
    const sql = readFileSync('supabase/migrations/0038_quality.sql', 'utf8')
    const allowed = sql.match(/v_allowed text\[\] := array\[([\s\S]*?)\];/)?.[1] ?? ''
    const ids = [...allowed.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(ids.sort()).toEqual([...surveyQuestionIds].sort())
  })

  it('medie per area, per docente e quota di soddisfatti', () => {
    const s = summarizeResponses([
      { scores: { docenza_chiarezza: 5, docenza_competenza: 4 }, teacher_scores: { t1: 5 }, liked: 'bello', suggestions: '', submitted_at: '' },
      { scores: { docenza_chiarezza: 3, docenza_competenza: 2 }, teacher_scores: { t1: 3, t2: 2 }, liked: '', suggestions: '', submitted_at: '' },
    ])
    expect(s.responses).toBe(2)
    expect(s.byQuestion.docenza_chiarezza).toBe(4)
    expect(s.byGroup.docenza).toBe(3.5)
    expect(s.byGroup.materiale).toBeNull()
    expect(s.byTeacher.t1).toEqual({ mean: 4, count: 2 })
    expect(s.satisfiedShare).toBe(0.5)
    expect(s.comments).toHaveLength(1)
    expect(fmtScore(3.5)).toBe('3,50')
    expect(fmtScore(null)).toBe('—')
  })

  it('segnala le domande senza voto, tranne le facoltative', () => {
    const all = Object.fromEntries(surveyQuestionIds.map((id) => [id, 4]))
    expect(unansweredQuestions(all)).toEqual([])
    const { ambiente_aule: _a, docenza_chiarezza: _d, ...rest } = all
    void _a
    void _d
    expect(unansweredQuestions(rest, ['ambiente_aule'])).toEqual(['docenza_chiarezza'])
  })
})

describe('zip', () => {
  it('crc32 standard', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('nomi sicuri e unici', () => {
    expect(safeZipName('Documenti/a:b?.pdf')).toBe('Documenti/a_b_.pdf')
    expect(safeZipName('../x.pdf')).toBe('_/x.pdf')
    expect(uniquePaths(['a.pdf', 'A.pdf', 'b'])).toEqual(['a.pdf', 'A (2).pdf', 'b'])
  })

  it('struttura valida: firme, numero di voci e offset della directory centrale', () => {
    const zip = buildZip([
      { path: 'uno.txt', data: new TextEncoder().encode('ciao') },
      { path: 'cartella/due.txt', data: new TextEncoder().encode('mondo!') },
    ])
    const view = new DataView(zip.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const end = zip.length - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(2)
    const cdOffset = view.getUint32(end + 16, true)
    expect(view.getUint32(cdOffset, true)).toBe(0x02014b50)
    expect(cdOffset + view.getUint32(end + 12, true)).toBe(end)
  })
})

describe('fascicolo corso', () => {
  const base: DossierData = {
    course: {
      id: 'k',
      name: 'Skills for Green',
      edition: 'ED1 - 2026',
      code: '474',
      cup: 'J34D25003420007',
      notes: '',
      status: 'concluso' as never,
      start_date: '2026-01-28',
      end_date: '2026-04-30',
      duration_hours: 60,
      funding_decree: '',
      funding_program: '',
      moodle_course_id: 11,
      moodle_bbb_id: null,
      moodle_shortname: '',
      created_at: '',
      updated_at: '',
    },
    generatedAt: new Date('2026-11-16T10:00:00Z'),
    teachers: [],
    tutors: [],
    admins: [],
    students: 15,
    activeStudents: 14,
    lessons: 20,
    fadDays: 10,
    certificates: 14,
    deliveredCertificates: 14,
    protocol: 2,
    surveyResponses: 0,
    survey: summarizeResponses([]),
    documents: [{ name: 'test finale.pdf', title: 'Test finale', category: 'Modulo', date: '2026-04-30T10:00:00Z' }],
    missingFiles: [],
  }

  it('controlla le evidenze del punto 8.5', () => {
    const checks = Object.fromEntries(dossierChecks(base).map((c) => [c.label.slice(0, 12), c.ok]))
    expect(checks['Registro pre']).toBe(true)
    expect(checks["Verifiche de"]).toBe(true)
    expect(checks['Materiale di']).toBe(false)
    expect(checks['Attestati ne']).toBe(true)
    expect(checks['Questionari ']).toBe(false)
  })

  it("l'indice è HTML con i dati del corso e senza testo non protetto", () => {
    const html = buildDossierIndex({ ...base, documents: [{ ...base.documents[0], title: '<script>x</script>' }] })
    expect(html).toContain('Skills for Green')
    expect(html).toContain('J34D25003420007')
    expect(html).not.toContain('<script>x')
  })
})
