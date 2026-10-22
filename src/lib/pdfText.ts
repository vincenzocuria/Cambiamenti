/**
 * Testo di un PDF riga per riga, con le celle delle tabelle separate da due spazi.
 * pdf.js viene caricato solo quando serve (è pesante).
 */

export interface PdfTextItem {
  str: string
  /** Matrice di trasformazione: [4] = x, [5] = y. */
  transform: number[]
  width: number
}

/** Raggruppa i pezzi di testo per riga (stessa altezza) e li ordina da sinistra a destra. */
export function linesFromItems(items: PdfTextItem[]): string[] {
  const rows = new Map<number, PdfTextItem[]>()
  for (const item of items) {
    if (!item.str.trim()) continue
    const y = Math.round(item.transform[5] / 3) * 3
    const row = rows.get(y)
    if (row) row.push(item)
    else rows.set(y, [item])
  }
  const lines: string[] = []
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    const row = rows.get(y)!.sort((a, b) => a.transform[4] - b.transform[4])
    let line = ''
    let end: number | null = null
    for (const item of row) {
      if (end !== null) {
        const gap = item.transform[4] - end
        line += gap > 6 ? '  ' : gap > 1 ? ' ' : ''
      }
      line += item.str
      end = item.transform[4] + item.width
    }
    lines.push(line.trim())
  }
  return lines
}

/** Righe di testo di tutte le pagine; vuoto se il PDF è una scansione senza testo. */
export async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: bytes.slice() })
  const doc = await task.promise
  const lines: string[] = []
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      lines.push(...linesFromItems(content.items.flatMap((i) => ('str' in i ? [i] : []))))
    }
  } finally {
    void task.destroy()
  }
  return lines
}
