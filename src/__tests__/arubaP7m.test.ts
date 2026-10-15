import { describe, expect, it } from 'vitest'
import { extractInvoiceXml } from '../../supabase/functions/aruba-invoice/aruba'

const xml = '<?xml version="1.0"?><p:FatturaElettronica versione="FPR12"><a>è</a></p:FatturaElettronica>'
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const utf8 = (s: string) => new TextEncoder().encode(s)

describe('file fattura da Aruba', () => {
  it('XML semplice', () => {
    expect(extractInvoiceXml(b64(utf8(xml)))).toBe(xml)
  })

  it('p7m: XML dentro la busta firmata', () => {
    const p7m = new Uint8Array([0x30, 0x80, 0x06, 0x09, ...utf8(xml), 0xa0, 0x82, 0x01, 0x02])
    expect(extractInvoiceXml(b64(p7m))).toBe(xml)
  })

  it('p7m in base64 a sua volta', () => {
    const p7m = new Uint8Array([0x30, 0x82, 0x05, 0x10, ...utf8(xml), 0x00])
    const inner = b64(p7m)
    expect(inner.startsWith('MII')).toBe(true)
    expect(extractInvoiceXml(b64(utf8(inner)))).toBe(xml)
  })

  it('p7m a blocchi: toglie le intestazioni tra i blocchi', () => {
    const body = utf8(xml)
    const chunked = new Uint8Array([
      0x24, 0x80, 0x04, 0x82, 0x00, 0x20, ...body.slice(0, 32), 0x04, 0x82, 0x00, 0x40, ...body.slice(32), 0x00,
    ])
    expect(extractInvoiceXml(b64(chunked))).toBe(xml)
  })
})
