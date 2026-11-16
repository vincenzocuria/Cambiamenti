/**
 * Archivio ZIP senza compressione (metodo «store»): basta per raccogliere PDF e documenti già
 * compressi in un unico file da consegnare, senza librerie esterne. Nomi in UTF-8.
 */

export interface ZipEntry {
  path: string
  data: Uint8Array
  date?: Date
}

let crcTable: Uint32Array | null = null

function table(): Uint32Array {
  if (crcTable) return crcTable
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  crcTable = t
  return t
}

export function crc32(data: Uint8Array): number {
  const t = table()
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear())
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/** Nome di file sicuro dentro lo ZIP: niente caratteri vietati su Windows, niente «..». */
export function safeZipName(name: string): string {
  const cleaned = name
    .replace(/[\\:*?"<>|]/g, '_')
    .split('/')
    .map((part) => part.trim().replace(/^\.+$/, '_'))
    .filter(Boolean)
    .join('/')
  return cleaned || 'file'
}

/** Rende unici i percorsi ripetuti: «a.pdf», «a (2).pdf». */
export function uniquePaths(paths: string[]): string[] {
  const seen = new Map<string, number>()
  return paths.map((p) => {
    const key = p.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    if (n === 1) return p
    const dot = p.lastIndexOf('.')
    const slash = p.lastIndexOf('/')
    return dot > slash + 1 ?`${p.slice(0, dot)} (${n})${p.slice(dot)}` : `${p} (${n})`
  })
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const paths = uniquePaths(entries.map((e) => safeZipName(e.path)))
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  entries.forEach((entry, i) => {
    const name = enc.encode(paths[i])
    const crc = crc32(entry.data)
    const size = entry.data.length
    const { time, date } = dosDateTime(entry.date ?? new Date())

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true) // nomi UTF-8
    lv.setUint16(8, 0, true) // store
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)
    locals.push(local, entry.data)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)

    offset += local.length + size
  })

  const centralSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + centralSize + end.length)
  let pos = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}
