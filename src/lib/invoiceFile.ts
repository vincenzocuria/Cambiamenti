import { school } from '../data/school'
import type { ParsedInvoice } from './fatturaPa'
import type { InvoiceDirection } from '../types/db'
import { p7mContent, p7mToDer } from './p7m'

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

/** Estrae l'XML della fattura da un file XML o firmato (.p7m), anche in base64. */
export function invoiceXmlFromBytes(input: Uint8Array): string {
  let bytes = p7mToDer(input)
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
