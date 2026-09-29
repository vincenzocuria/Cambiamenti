/** Parser CSV minimale (virgola o punto e virgola, campi tra virgolette). */

export function parseCsv(text: string): string[][] {
  const trimmed = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()
  if (!trimmed) return []

  const delimiter = detectDelimiter(trimmed.split('\n')[0] ?? '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    const next = trimmed[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === delimiter) {
      row.push(field)
      field = ''
      continue
    }

    if (ch === '\n') {
      row.push(field)
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += ch
  }

  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

function detectDelimiter(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) ?? []).length
  const semis = (headerLine.match(/;/g) ?? []).length
  return semis > commas ? ';' : ','
}

export function csvRowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const headers = rows[0].map(normalizeHeader)
  const out: Record<string, string>[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    if (cells.every((c) => !c.trim())) continue
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = (cells[i] ?? '').trim()
    })
    out.push(obj)
  }
  return out
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
}
