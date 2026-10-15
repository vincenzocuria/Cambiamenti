import { school } from '../data/school'
import type { ParsedInvoice } from './fatturaPa'
import type { InvoiceDirection } from '../types/db'

/**
 * Lettura dei file fattura scaricati dal pannello Aruba: XML, XML firmato (.p7m),
 * .p7m in base64 e archivi .zip che li contengono.
 */

function indexOfBytes(hay: Uint8Array, needle: string, from = 0): number {
  const n = new TextEncoder().encode(needle)
  outer: for (let i = from; i <= hay.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer
    return i
  }
  return -1
}

function lastIndexOfBytes(hay: Uint8Array, needle: string): number {
  const n = new TextEncoder().encode(needle)
  outer: for (let i = hay.length - n.length; i >= 0; i--) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer
    return i
  }
  return -1
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Decodifica rispettando l'encoding dichiarato nell'XML (alcuni gestionali usano ISO-8859-1). */
function decodeXml(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 120))
  const declared = /encoding=["']([\w-]+)["']/i.exec(head)?.[1]?.toLowerCase()
  const encoding = declared && declared !== 'utf-8' && declared !== 'utf8' ? declared : 'utf-8'
  try {
    return new TextDecoder(encoding).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '')
  }
}

/** OID id-data (1.2.840.113549.1.7.1): dopo di esso, nel .p7m, c'è il contenuto firmato. */
const ID_DATA = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]

/** Legge tipo e lunghezza di un elemento DER/BER; length -1 = lunghezza indefinita. */
function readTl(b: Uint8Array, p: number): { tag: number; length: number; header: number } {
  const tag = b[p]
  const first = b[p + 1]
  if (first < 0x80) return { tag, length: first, header: 2 }
  if (first === 0x80) return { tag, length: -1, header: 2 }
  const n = first & 0x7f
  let length = 0
  for (let i = 0; i < n; i++) length = length * 256 + b[p + 2 + i]
  return { tag, length, header: 2 + n }
}

/**
 * Raccoglie il contenuto di un OCTET STRING, anche spezzato a blocchi (forma costruita,
 * con lunghezza definita o indefinita). Restituisce i byte e la posizione dopo l'elemento.
 */
function readOctets(b: Uint8Array, p: number, out: number[]): number {
  const { tag, length, header } = readTl(b, p)
  const start = p + header
  if (tag === 0x04) {
    for (let i = start; i < start + length; i++) out.push(b[i])
    return start + length
  }
  if (tag !== 0x24) throw new Error('contenuto firmato non leggibile')
  let q = start
  if (length < 0) {
    while (!(b[q] === 0 && b[q + 1] === 0)) q = readOctets(b, q, out)
    return q + 2
  }
  while (q < start + length) q = readOctets(b, q, out)
  return q
}

/** Contenuto firmato di un .p7m (CMS SignedData), oppure null se non è un .p7m. */
function p7mContent(b: Uint8Array): Uint8Array | null {
  outer: for (let i = 0; i <= b.length - ID_DATA.length; i++) {
    for (let j = 0; j < ID_DATA.length; j++) if (b[i + j] !== ID_DATA[j]) continue outer
    let p = i + ID_DATA.length
    if (b[p] !== 0xa0) continue // id-data senza contenuto (es. tra gli attributi firmati)
    p += readTl(b, p).header
    try {
      const out: number[] = []
      readOctets(b, p, out)
      return new Uint8Array(out)
    } catch {
      return null
    }
  }
  return null
}

const BASE64 = /^[A-Za-z0-9+/=\s]+$/

/** Estrae l'XML della fattura da un file XML o firmato (.p7m), anche in base64. */
export function invoiceXmlFromBytes(input: Uint8Array): string {
  let bytes = input
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 64))
  // .p7m salvato in base64 (DER che inizia con 0x30 → «MI…»)
  if (head.startsWith('MI') && BASE64.test(head)) bytes = base64ToBytes(new TextDecoder('latin1').decode(bytes))
  if (bytes[0] === 0x30) bytes = p7mContent(bytes) ?? bytes

  let start = indexOfBytes(bytes, '<?xml')
  if (start < 0) {
    const root = indexOfBytes(bytes, 'FatturaElettronica')
    start = root < 0 ? -1 : bytes.lastIndexOf(0x3c, root)
  }
  const endTag = lastIndexOfBytes(bytes, 'FatturaElettronica>')
  if (start < 0 || endTag < 0) throw new Error('non è una fattura elettronica')
  return decodeXml(bytes.slice(start, endTag + 'FatturaElettronica>'.length))
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data as Uint8Array<ArrayBuffer>)
      controller.close()
    },
  })
  const stream = source.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

/** File contenuti in un archivio .zip (solo file, cartelle escluse). */
export async function readZip(bytes: Uint8Array): Promise<{ name: string; bytes: Uint8Array }[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('archivio zip non leggibile')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const names = new TextDecoder('utf-8')
  const out: { name: string; bytes: Uint8Array }[] = []
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('archivio zip non leggibile')
    const method = view.getUint16(p + 10, true)
    const compressed = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const local = view.getUint32(p + 42, true)
    const name = names.decode(bytes.slice(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const raw = bytes.slice(dataStart, dataStart + compressed)
    if (method === 0) out.push({ name, bytes: raw })
    else if (method === 8) out.push({ name, bytes: await inflateRaw(raw) })
    else throw new Error(`${name}: compressione zip non supportata`)
  }
  return out
}

/** Ricevute e notifiche SdI (non sono fatture): IT01234567890_abcde_RC_001.xml ecc. */
export function isSdiNotification(name: string): boolean {
  return /_(RC|NS|MC|NE|DT|AT|EC|SE|MT)_\w+\.xml/i.test(name)
}

const baseName = (name: string) => name.split('/').pop() ?? name

/**
 * Espande i file scelti (anche zip, anche zip dentro zip) in fatture XML.
 * Restituisce le fatture lette e, per gli altri file, il motivo dello scarto.
 */
export async function expandInvoiceFiles(
  files: { name: string; bytes: Uint8Array }[],
): Promise<{ invoices: { name: string; xml: string }[]; skipped: string[] }> {
  const invoices: { name: string; xml: string }[] = []
  const skipped: string[] = []
  const queue = [...files]
  while (queue.length) {
    const file = queue.shift()!
    const name = baseName(file.name)
    try {
      if (isZip(file.bytes)) {
        queue.push(...(await readZip(file.bytes)))
        continue
      }
      if (isSdiNotification(name) || /\.(pdf|html?|txt|xsl)$/i.test(name)) continue
      invoices.push({ name, xml: invoiceXmlFromBytes(file.bytes) })
    } catch (err) {
      skipped.push(`${name}: ${err instanceof Error ? err.message : 'file non leggibile'}`)
    }
  }
  return { invoices, skipped }
}

const ownId = (value: string) => value.trim().toUpperCase().replace(/^IT/, '')

/** Emessa se Cambia-Menti è il cedente, ricevuta se è il cliente; altrimenti non ci riguarda. */
export function invoiceDirection(p: ParsedInvoice): InvoiceDirection | null {
  const us = school.vatNumber
  if (ownId(p.sellerVat) === us || ownId(p.sellerTaxCode) === us) return 'out'
  if (ownId(p.buyerVat) === us || ownId(p.buyerTaxCode) === us) return 'in'
  return null
}
