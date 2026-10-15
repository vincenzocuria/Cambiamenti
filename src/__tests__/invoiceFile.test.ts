import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  expandInvoiceFiles,
  invoiceDirection,
  invoiceXmlFromBytes,
  isSdiNotification,
  readZip,
} from '../lib/invoiceFile'
import { parseFatturaPa } from '../lib/fatturaPa'

const utf8 = (s: string) => new TextEncoder().encode(s)

function invoice(seller: string, buyer: string, number = '44', extra = 'è') {
  return `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
<FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${seller}</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Venditore ${extra}</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore>
<CessionarioCommittente><DatiAnagrafici><CodiceFiscale>${buyer}</CodiceFiscale><Anagrafica><Nome>Mario</Nome><Cognome>Rossi</Cognome></Anagrafica></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader>
<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-10-01</Data><Numero>${number}</Numero><ImportoTotaleDocumento>122.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi><DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Corso</Descrizione><PrezzoUnitario>100.00</PrezzoUnitario><PrezzoTotale>100.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>100.00</ImponibileImporto><Imposta>22.00</Imposta></DatiRiepilogo></DatiBeniServizi></FatturaElettronicaBody></p:FatturaElettronica>`
}

/** Zip minimo (stored o deflate) come quelli scaricati dal pannello Aruba. */
function zip(entries: { name: string; data: Uint8Array; deflate?: boolean }[]): Uint8Array {
  const parts: number[] = []
  const central: number[] = []
  const u16 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff)
  const u32 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff)
  for (const e of entries) {
    const name = utf8(e.name)
    const body = e.deflate ? new Uint8Array(deflateRawSync(e.data)) : e.data
    const offset = parts.length
    u32(parts, 0x04034b50); u16(parts, 20); u16(parts, 0); u16(parts, e.deflate ? 8 : 0); u32(parts, 0); u32(parts, 0)
    u32(parts, body.length); u32(parts, e.data.length); u16(parts, name.length); u16(parts, 0)
    parts.push(...name, ...body)
    u32(central, 0x02014b50); u16(central, 20); u16(central, 20); u16(central, 0); u16(central, e.deflate ? 8 : 0)
    u32(central, 0); u32(central, 0); u32(central, body.length); u32(central, e.data.length)
    u16(central, name.length); u16(central, 0); u16(central, 0); u16(central, 0); u16(central, 0); u32(central, 0)
    u32(central, offset); central.push(...name)
  }
  const cdOffset = parts.length
  const end: number[] = []
  u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, entries.length); u16(end, entries.length)
  u32(end, central.length); u32(end, cdOffset); u16(end, 0)
  return new Uint8Array([...parts, ...central, ...end])
}

describe('file fattura scaricati da Aruba', () => {
  const xml = invoice('03936190788', 'RSSMRA80A01H501U')

  it('XML semplice e firmato .p7m', () => {
    expect(invoiceXmlFromBytes(utf8(xml))).toBe(xml)
    const p7m = new Uint8Array([0x30, 0x80, 0x06, 0x09, ...utf8(xml), 0xa0, 0x82, 0x01, 0x02])
    expect(invoiceXmlFromBytes(p7m)).toBe(xml)
  })

  it('p7m in base64', () => {
    const p7m = new Uint8Array([0x30, 0x82, 0x05, 0x10, ...utf8(xml), 0x00])
    const b64 = Buffer.from(p7m).toString('base64')
    expect(invoiceXmlFromBytes(utf8(b64))).toBe(xml)
  })

  it('rispetta l’encoding ISO-8859-1 dichiarato', () => {
    const latin = invoice('03936190788', 'X').replace('UTF-8', 'ISO-8859-1')
    const bytes = new Uint8Array([...latin].map((c) => c.charCodeAt(0)))
    expect(invoiceXmlFromBytes(bytes)).toContain('Venditore è')
  })

  it('legge zip con file compressi e non, anche annidati, e salta notifiche e PDF', async () => {
    const inner = zip([{ name: 'IT01234567890_aaaaa.xml', data: utf8(invoice('01234567890', '03936190788', '7')), deflate: true }])
    const archive = zip([
      { name: 'emesse/IT03936190788_0001a.xml.p7m', data: new Uint8Array([0x30, 0x80, ...utf8(xml), 0x00]), deflate: true },
      { name: 'IT03936190788_0001a_RC_001.xml', data: utf8('<RicevutaConsegna/>') },
      { name: 'fattura.pdf', data: utf8('%PDF') },
      { name: 'ricevute.zip', data: inner },
    ])
    expect((await readZip(archive)).map((f) => f.name)).toContain('emesse/IT03936190788_0001a.xml.p7m')
    const { invoices, skipped } = await expandInvoiceFiles([{ name: 'aruba.zip', bytes: archive }])
    expect(skipped).toEqual([])
    expect(invoices.map((i) => i.name)).toEqual(['IT03936190788_0001a.xml.p7m', 'IT01234567890_aaaaa.xml'])
    expect(parseFatturaPa(invoices[1].xml).number).toBe('7')
  })

  it('segnala i file che non sono fatture', async () => {
    const { invoices, skipped } = await expandInvoiceFiles([{ name: 'note.xml', bytes: utf8('<a/>') }])
    expect(invoices).toEqual([])
    expect(skipped[0]).toMatch(/note\.xml/)
  })

  it('riconosce le notifiche SdI', () => {
    expect(isSdiNotification('IT03936190788_0001a_NS_001.xml')).toBe(true)
    expect(isSdiNotification('IT03936190788_0001a.xml')).toBe(false)
  })

  it('emessa o ricevuta in base a chi è Cambia-Menti', () => {
    expect(invoiceDirection(parseFatturaPa(xml))).toBe('out')
    expect(invoiceDirection(parseFatturaPa(invoice('01234567890', '03936190788')))).toBe('in')
    expect(invoiceDirection(parseFatturaPa(invoice('01234567890', 'RSSMRA80A01H501U')))).toBeNull()
  })
})
