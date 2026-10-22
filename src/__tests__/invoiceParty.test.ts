import { describe, expect, it } from 'vitest'
import { buildInvoiceXml, parseFatturaPa, type InvoiceDraft } from '../lib/fatturaPa'
import { customerFromParty, partyKey } from '../lib/customer'
import type { Customer } from '../types/db'

const draft = {
  doc_type: 'TD01',
  number: '12',
  invoice_date: '2026-10-20',
  lines: [{ description: 'Certificazione EIPASS', quantity: 1, unit_price: 100, vat_rate: 22, nature: '' }],
  payment_method: 'MP05',
  payment_due: '',
  causale: '',
} as unknown as InvoiceDraft

const person = {
  company_name: '',
  first_name: 'MARIO',
  last_name: 'ROSSI',
  vat_number: '',
  tax_code: 'RSSMRA80A01H501U',
  address: 'Via Roma 1',
  postal_code: '87064',
  city: 'CORIGLIANO-ROSSANO',
  province: 'CS',
  country: 'IT',
  sdi_code: '0000000',
  pec: '',
} as Customer

describe('anagrafiche dalle fatture', () => {
  it('crea il cliente persona fisica dai dati del cessionario', () => {
    const p = parseFatturaPa(buildInvoiceXml(draft, person))
    const c = customerFromParty(p.buyer, { sdiCode: p.buyerSdiCode, pec: p.buyerPec })
    expect(c.first_name).toBe('Mario')
    expect(c.last_name).toBe('Rossi')
    expect(c.tax_code).toBe('RSSMRA80A01H501U')
    expect(c.postal_code).toBe('87064')
    expect(c.province).toBe('CS')
    expect(partyKey(c)).toBe('cf:RSSMRA80A01H501U')
  })

  it('il fornitore è il cedente, riconosciuto per partita IVA', () => {
    const p = parseFatturaPa(buildInvoiceXml(draft, person))
    const s = customerFromParty(p.seller)
    expect(s.company_name).toMatch(/Cambia-Menti/)
    expect(partyKey(s)).toBe('vat:03936190788')
  })
})
