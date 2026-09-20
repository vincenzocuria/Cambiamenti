function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cell(value: string, tag: 'th' | 'td'): string {
  return `<${tag}>${escapeHtml(value)}</${tag}>`
}

/** Apre una finestra di stampa per salvare l’elenco in PDF. */
export function exportPdf(opts: {
  title: string
  headers: string[]
  rows: string[][]
  filters?: string
}): void {
  const printedAt = new Date().toLocaleString('it-IT')
  const header = opts.headers.map((h) => cell(h, 'th')).join('')
  const body = opts.rows
    .map((row) => `<tr>${row.map((v) => cell(v, 'td')).join('')}</tr>`)
    .join('')
  const filterLine = opts.filters
    ? `<p class="meta">Filtri: ${escapeHtml(opts.filters)}</p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1e293b; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 6px; }
    .meta { font-size: 11px; color: #64748b; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
    @page { size: A4 landscape; margin: 12mm; }
  </style>
</head>
<body>
  <h1>${escapeHtml(opts.title)}</h1>
  <p class="meta">Stampato il ${escapeHtml(printedAt)} · ${opts.rows.length} righe</p>
  ${filterLine}
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${body || `<tr><td colspan="${opts.headers.length}">Nessun dato.</td></tr>`}</tbody>
  </table>
</body>
</html>`

  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) {
    window.alert('Consenti i popup del browser per esportare il PDF.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.addEventListener('load', () => {
    win.focus()
    win.print()
  })
}
