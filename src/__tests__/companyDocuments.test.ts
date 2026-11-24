import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  addDaysIso,
  companyProgress,
  expiringCompanyDocuments,
  expiryLabel,
  expiryState,
  filterCompanyDocuments,
  renewalInput,
  sortCompanyDocuments,
  suggestedExpiry,
  type CompanyDocument,
} from '../lib/companyDocuments'

const doc = (over: Partial<CompanyDocument>): CompanyDocument => ({
  id: 'd',
  category: 'societari',
  title: 'Visura camerale',
  issuer: 'Camera di Commercio',
  reference: '',
  issued_on: null,
  expires_on: null,
  notes: '',
  file_name: '',
  storage_path: null,
  mime_type: '',
  size_bytes: 0,
  quality_document_id: null,
  replaces_id: null,
  superseded_at: null,
  sort_order: 0,
  created_at: '2026-11-24T00:00:00Z',
  updated_at: '2026-11-24T00:00:00Z',
  ...over,
})

const today = '2026-11-24'

describe('scadenze', () => {
  it('distingue scaduto, in scadenza (30 giorni) e valido', () => {
    expect(expiryState(doc({ expires_on: '2026-11-23' }), today)).toBe('scaduto')
    expect(expiryState(doc({ expires_on: '2026-11-24' }), today)).toBe('in_scadenza')
    expect(expiryState(doc({ expires_on: '2026-12-24' }), today)).toBe('in_scadenza')
    expect(expiryState(doc({ expires_on: '2026-12-25' }), today)).toBe('valido')
    expect(expiryState(doc({ expires_on: null }), today)).toBeNull()
  })

  it('una versione superata non scade più', () => {
    expect(expiryState(doc({ expires_on: '2026-01-01', superseded_at: '2026-02-01T00:00:00Z' }), today)).toBeNull()
  })

  it('scrive la scadenza in parole', () => {
    expect(expiryLabel('2026-11-24', today)).toBe('scade oggi')
    expect(expiryLabel('2026-11-25', today)).toBe('scade domani')
    expect(expiryLabel('2026-12-04', today)).toBe('scade tra 10 giorni')
    expect(expiryLabel('2026-11-21', today)).toBe('scaduto da 3 giorni')
  })

  it('il DURC vale 120 giorni dalla data di rilascio', () => {
    expect(addDaysIso('2026-03-30', 2)).toBe('2026-04-01')
    expect(suggestedExpiry('DURC', '2026-11-24')).toBe('2027-03-24')
    expect(suggestedExpiry('Visura camerale', '2026-11-24')).toBeNull()
    expect(suggestedExpiry('DURC', null)).toBeNull()
  })

  it('in dashboard la più urgente prima, solo scaduti e in scadenza', () => {
    const list = expiringCompanyDocuments(
      [
        doc({ id: 'a', expires_on: '2026-12-10' }),
        doc({ id: 'b', expires_on: '2026-11-01' }),
        doc({ id: 'c', expires_on: '2027-06-01' }),
        doc({ id: 'd' }),
      ],
      today,
    )
    expect(list.map((d) => d.id)).toEqual(['b', 'a'])
  })
})

describe('elenco', () => {
  const docs = [
    doc({ id: 'v', storage_path: 'company/v/x.pdf', file_name: 'visura.pdf' }),
    doc({ id: 'durc', category: 'fiscali', title: 'DURC', expires_on: '2026-12-01', storage_path: 'company/d/x.pdf' }),
    doc({ id: 'old', category: 'fiscali', title: 'DURC', superseded_at: '2026-08-01T00:00:00Z', issued_on: '2026-04-01' }),
    doc({ id: 'rc', category: 'polizze', title: 'Polizza RC' }),
  ]

  it('conta caricati, mancanti e scadenze senza le versioni superate', () => {
    expect(companyProgress(docs, today)).toEqual({ total: 3, loaded: 2, missing: 1, expired: 0, expiring: 1 })
  })

  it('filtra per vista, categoria e ricerca', () => {
    const f = (over: object) =>
      filterCompanyDocuments(docs, { category: 'tutte', view: 'correnti', query: '', ...over }, today).map((d) => d.id)
    expect(f({})).toEqual(['v', 'durc', 'rc'])
    expect(f({ view: 'da_caricare' })).toEqual(['rc'])
    expect(f({ view: 'scadenze' })).toEqual(['durc'])
    expect(f({ view: 'superati' })).toEqual(['old'])
    expect(f({ category: 'fiscali' })).toEqual(['durc'])
    expect(f({ query: 'camera visura' })).toEqual(['v'])
  })

  it('ordina per categoria', () => {
    expect(sortCompanyDocuments([docs[3], docs[1], docs[0]]).map((d) => d.id)).toEqual(['v', 'durc', 'rc'])
  })

  it('il rinnovo tiene i dati ma non date, numero e file', () => {
    const r = renewalInput(doc({ title: 'DURC', reference: 'INAIL_1', issued_on: '2026-04-01', expires_on: '2026-07-29', quality_document_id: 'q' }))
    expect(r).toMatchObject({ title: 'DURC', reference: '', issued_on: null, expires_on: null, quality_document_id: 'q' })
  })
})

describe('migrazione', () => {
  const sql = readFileSync('supabase/migrations/0043_company_documents.sql', 'utf8')

  it('le categorie del database sono quelle dell’app', () => {
    for (const c of ['societari', 'accreditamento', 'fiscali', 'sede', 'polizze', 'certificazioni', 'privacy', 'contratti', 'altro']) {
      expect(sql).toContain(`'${c}'`)
    }
  })

  it('il seed parte solo su tabella vuota', () => {
    expect(sql).toMatch(/where not exists \(select 1 from public\.company_documents\)/)
  })
})
