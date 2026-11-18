/** Documento HTML stampabile da un modello compilato, e nome file. */

export function toHtmlDocument(title: string, body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br />')}</p>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${title.replace(/</g, '')}</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.5; color: #111; }
    p { margin: 0 0 1em; white-space: pre-wrap; }
  </style>
</head>
<body>
${paragraphs}
</body>
</html>`
}

export function slugFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60)
}
