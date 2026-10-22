import { describe, expect, it } from 'vitest'
import {
  buildEipassInvoiceXml,
  invoiceAmounts,
  invoiceMissingFields,
  matchInvoiceToCandidate,
  nextInvoiceNumber,
  parseInvoiceXml,
} from '../lib/eipassInvoice'
import type { EipassCandidate } from '../types/db'

function candidate(extra: Partial<EipassCandidate> = {}): EipassCandidate {
  return {
    id: '1',
    first_name: 'Mario',
    last_name: 'Rossi',
    birth_date: null,
    birth_place: '',
    tax_code: 'RSSMRA80A01D086X',
    gender: 'M',
    address: 'Via Roma 1',
    city: 'Corigliano-Rossano',
    postal_code: '87064',
    province: 'CS',
    phone: '',
    email: '',
    doc_type: '',
    doc_number: '',
    doc_expiry_date: null,
    certification: 'EIPASS 7 Moduli User',
    purchase_date: '2026-10-01',
    exam_done: false,
    exam_date: null,
    certificate_type: '',
    certificate_expiry: null,
    amount: 122,
    vat_rate: 22,
    payment_method: 'bonifico',
    payment_date: '2026-10-02',
    invoice_status: 'da_fatturare',
    invoice_number: '7',
    invoice_date: '2026-10-15',
    notes: '',
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

describe('importi fattura', () => {
  it('scorpora l’IVA al 22%', () => {
    expect(invoiceAmounts(122, 22)).toMatchObject({ taxable: 100, vat: 22, total: 122, stamp: 0 })
  })

  it('esente sopra 77,47 € aggiunge il bollo da 2 €', () => {
    expect(invoiceAmounts(150, 0)).toMatchObject({ taxable: 150, vat: 0, stamp: 2 })
    expect(invoiceAmounts(50, 0).stamp).toBe(0)
  })
})

describe('numerazione', () => {
  it('propone il numero successivo dell’anno', () => {
    const rows = [
      { invoice_number: '3', invoice_date: '2026-02-01' },
      { invoice_number: '12/2026', invoice_date: '2026-05-01' },
      { invoice_number: '40', invoice_date: '2025-12-01' },
      { invoice_number: '', invoice_date: null },
    ]
    expect(nextInvoiceNumber(rows, 2026)).toBe('13')
    expect(nextInvoiceNumber(rows, 2027)).toBe('1')
  })
})

describe('fattura XML per Aruba', () => {
  it('segnala i dati mancanti', () => {
    expect(invoiceMissingFields(candidate({ amount: null, postal_code: '' }))).toEqual([
      'importo pagato',
      'CAP',
    ])
    expect(() => buildEipassInvoiceXml(candidate({ tax_code: '' }))).toThrow(/codice fiscale/)
  })

  it('genera un XML FPR12 coerente e rileggibile', () => {
    const xml = buildEipassInvoiceXml(candidate(), 'AB123')
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    const get = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent
    expect(get('FormatoTrasmissione')).toBe('FPR12')
    expect(get('ProgressivoInvio')).toBe('AB123')
    expect(get('CodiceDestinatario')).toBe('0000000')
    expect(get('ImponibileImporto')).toBe('100.00')
    expect(get('Imposta')).toBe('22.00')
    expect(get('ImportoTotaleDocumento')).toBe('122.00')
    expect(get('ModalitaPagamento')).toBe('MP05')
    expect(get('Descrizione')).toContain('EIPASS 7 Moduli User')

    const parsed = parseInvoiceXml(xml, 'f.xml')
    expect(parsed).toMatchObject({ number: '7', date: '2026-10-15', taxCode: 'RSSMRA80A01D086X', total: 122 })
  })

  it('esente IVA usa natura N4 e bollo virtuale', () => {
    const xml = buildEipassInvoiceXml(candidate({ amount: 150, vat_rate: 0 }), 'AB124')
    expect(xml).toContain('<Natura>N4</Natura>')
    expect(xml).toContain('<BolloVirtuale>SI</BolloVirtuale>')
    expect(xml).toContain('<ImportoTotaleDocumento>152.00</ImportoTotaleDocumento>')
  })

  it('protegge i caratteri speciali', () => {
    const xml = buildEipassInvoiceXml(candidate({ address: 'Via <Dante> & C.', last_name: "D'Àngelo" }))
    expect(xml).toContain('Via &lt;Dante&gt; &amp; C.')
    expect(xml).toContain('D&apos;Angelo')
  })
})

describe('import fatture da Aruba', () => {
  it('abbina per codice fiscale e importo', () => {
    const invoice = parseInvoiceXml(buildEipassInvoiceXml(candidate({ invoice_number: '9' })), 'a.xml')
    const pool = [
      candidate({ id: 'a', amount: 80, invoice_number: '', invoice_date: null }),
      candidate({ id: 'b', amount: 122, invoice_number: '', invoice_date: null }),
      candidate({ id: 'c', tax_code: 'VRDLGU80A01H501Z', invoice_number: '' }),
    ]
    expect(matchInvoiceToCandidate(invoice, pool)?.id).toBe('b')
  })

  it('nessun abbinamento con codice fiscale sconosciuto', () => {
    const invoice = parseInvoiceXml(buildEipassInvoiceXml(candidate()), 'a.xml')
    expect(matchInvoiceToCandidate(invoice, [candidate({ tax_code: 'VRDLGU80A01H501Z' })])).toBeNull()
  })

  it('rifiuta file che non sono fatture', () => {
    expect(() => parseInvoiceXml('<a/>', 'x.xml')).toThrow(/non è una fattura/)
    expect(() => parseInvoiceXml('non xml', 'x.xml')).toThrow()
  })
})
