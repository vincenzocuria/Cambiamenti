import { describe, expect, it } from 'vitest'
import { buildInvoiceXml, computeTotals, parseFatturaPa, type InvoiceDraft } from '../lib/fatturaPa'
import { emptyCustomer } from '../components/CustomerForm'
import type { Customer } from '../types/db'

const company: Customer = {
  ...emptyCustomer,
  id: 'c1',
  company_name: 'Comune di Prova',
  vat_number: 'IT01234567890',
  tax_code: '01234567890',
  address: 'Piazza Municipio 1',
  postal_code: '87064',
  city: 'Corigliano-Rossano',
  province: 'CS',
  sdi_code: 'ABC1234',
  created_at: '',
  updated_at: '',
}

const draft: InvoiceDraft = {
  doc_type: 'TD01',
  number: 'FPR 45/26',
  invoice_date: '2026-10-15',
  causale: 'Corso di formazione',
  payment_method: 'bonifico',
  payment_due: null,
  stamp: null,
  lines: [
    { description: 'Docenza 10 ore', quantity: 10, unit_price: 50, vat_rate: 22, nature: '' },
    { description: 'Formazione esente', quantity: 1, unit_price: 200, vat_rate: 0, nature: 'N4' },
  ],
}

describe('fattura manuale FatturaPA', () => {
  it('calcola imponibile, IVA e bollo per riga esente sopra soglia', () => {
    const t = computeTotals(draft.lines)
    expect(t.taxable).toBe(700)
    expect(t.vat).toBe(110)
    expect(t.stamp).toBe(2)
    expect(t.total).toBe(812)
  })

  it('genera un XML che rileggo con gli stessi dati', () => {
    const xml = buildInvoiceXml(draft, company, 'AB123')
    expect(xml).toContain('<CodiceDestinatario>ABC1234</CodiceDestinatario>')
    expect(xml).toContain('<IdCodice>01234567890</IdCodice>')
    const p = parseFatturaPa(xml)
    expect(p.number).toBe('FPR 45/26')
    expect(p.buyerName).toBe('Comune di Prova')
    expect(p.total).toBe(812)
    expect(p.lines).toHaveLength(2)
    expect(p.lines[1].nature).toBe('N4')
    if (process.env.OUT_XML) require('node:fs').writeFileSync(process.env.OUT_XML, xml)
  })

  it('rifiuta un cliente senza indirizzo', () => {
    expect(() => buildInvoiceXml(draft, { ...company, address: '' })).toThrow(/indirizzo/)
  })
})
