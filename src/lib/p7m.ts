/**
 * Buste firmate digitalmente (CAdES / .p7m): estrazione del file originale e
 * dei nomi dei firmatari dai certificati. La firma non viene verificata.
 */

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
export function p7mContent(b: Uint8Array): Uint8Array | null {
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

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Se il .p7m è salvato in base64 o PEM, lo riporta in binario (DER). */
export function p7mToDer(bytes: Uint8Array): Uint8Array {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 64))
  if (head.startsWith('-----BEGIN')) {
    const text = new TextDecoder('latin1').decode(bytes)
    const body = text.replace(/-----(BEGIN|END)[^-]*-----/g, '')
    return base64ToBytes(body)
  }
  // DER che inizia con 0x30 → in base64 «MI…»
  if (head.startsWith('MI') && BASE64.test(head)) return base64ToBytes(new TextDecoder('latin1').decode(bytes))
  return bytes
}

/** OID degli attributi del titolare nel certificato: nome (2.5.4.42) e cognome (2.5.4.4). */
const OID_GIVEN_NAME = [0x06, 0x03, 0x55, 0x04, 0x2a]
const OID_SURNAME = [0x06, 0x03, 0x55, 0x04, 0x04]
const STRING_TAGS = new Set([0x0c, 0x13, 0x14, 0x16, 0x1e])

function stringsAfterOid(b: Uint8Array, oid: number[]): string[] {
  const found: string[] = []
  outer: for (let i = 0; i <= b.length - oid.length - 2; i++) {
    for (let j = 0; j < oid.length; j++) if (b[i + j] !== oid[j]) continue outer
    const p = i + oid.length
    const { tag, length, header } = readTl(b, p)
    if (!STRING_TAGS.has(tag) || length <= 0 || length > 200) continue
    const raw = b.slice(p + header, p + header + length)
    const value =
      tag === 0x1e
        ? new TextDecoder('utf-16be').decode(raw)
        : new TextDecoder(tag === 0x0c ? 'utf-8' : 'latin1').decode(raw)
    found.push(value.trim())
  }
  return found
}

/**
 * Nomi dei titolari dei certificati di firma (es. «GIORDANO BASILE»), senza ripetizioni.
 * I certificati delle autorità di certificazione non hanno nome e cognome, quindi restano fuori.
 */
export function p7mSigners(bytes: Uint8Array): string[] {
  const der = p7mToDer(bytes)
  const given = stringsAfterOid(der, OID_GIVEN_NAME)
  const surnames = stringsAfterOid(der, OID_SURNAME)
  const names = new Set<string>()
  for (let i = 0; i < Math.min(given.length, surnames.length); i++) {
    names.add(`${given[i]} ${surnames[i]}`.trim())
  }
  return [...names]
}

const SIGNED_EXT = /\.(p7m|m7m)$/i

export function isSignedFileName(name: string): boolean {
  return SIGNED_EXT.test(name)
}

/** Nome del file originale: «verbale.pdf.p7m» → «verbale.pdf» (anche con più firme annidate). */
export function unsignedFileName(name: string): string {
  let out = name
  while (SIGNED_EXT.test(out)) out = out.replace(SIGNED_EXT, '')
  return out
}

/**
 * File originale dentro la busta, anche se firmato più volte (.pdf.p7m.p7m).
 * Restituisce null se il file non è una busta leggibile.
 */
export function unwrapP7m(bytes: Uint8Array): Uint8Array | null {
  let current = p7mToDer(bytes)
  let unwrapped = false
  for (let depth = 0; depth < 5 && current[0] === 0x30; depth++) {
    const inner = p7mContent(current)
    if (!inner) break
    current = p7mToDer(inner)
    unwrapped = true
  }
  return unwrapped ? current : null
}
