import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isSignedFileName, p7mSigners, unsignedFileName, unwrapP7m } from '../lib/p7m'

const utf8 = (s: string) => new TextEncoder().encode(s)
const ID_DATA = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]

/** Busta minima: id-data + [0] + OCTET STRING col contenuto. */
function envelope(content: Uint8Array): Uint8Array {
  return new Uint8Array([0x30, 0x80, ...ID_DATA, 0xa0, 0x80, 0x04, content.length, ...content, 0, 0, 0, 0])
}

describe('file firmati .p7m', () => {
  it('nome del file originale', () => {
    expect(unsignedFileName('VERBALE_SALDO.pdf.p7m')).toBe('VERBALE_SALDO.pdf')
    expect(unsignedFileName('a.pdf.p7m.P7M')).toBe('a.pdf')
    expect(isSignedFileName('a.pdf.p7m')).toBe(true)
    expect(isSignedFileName('a.pdf')).toBe(false)
  })

  it('estrae il PDF dalla busta, anche con firma doppia', () => {
    const pdf = utf8('%PDF-1.5 contenuto')
    expect(Array.from(unwrapP7m(envelope(pdf))!)).toEqual(Array.from(pdf))
    expect(Array.from(unwrapP7m(envelope(envelope(pdf)))!)).toEqual(Array.from(pdf))
  })

  it('null se non è una busta firmata', () => {
    expect(unwrapP7m(utf8('%PDF-1.5'))).toBeNull()
  })

  it('nome e cognome del firmatario dal certificato', () => {
    const attr = (oid: number, value: string) => {
      const v = utf8(value)
      return [0x06, 0x03, 0x55, 0x04, oid, 0x0c, v.length, ...v]
    }
    const cert = new Uint8Array([0x30, 0x40, ...attr(0x04, 'BASILE'), ...attr(0x2a, 'GIORDANO')])
    expect(p7mSigners(cert)).toEqual(['GIORDANO BASILE'])
  })

  // File reale, se presente in locale (non è nel repository)
  const real = process.env.P7M_SAMPLE
  it.skipIf(!real || !existsSync(real))('file reale', () => {
    const bytes = new Uint8Array(readFileSync(real!))
    const inner = unwrapP7m(bytes)!
    expect(new TextDecoder('latin1').decode(inner.slice(0, 4))).toBe('%PDF')
    expect(p7mSigners(bytes)).toEqual(['GIORDANO BASILE'])
  })
})
