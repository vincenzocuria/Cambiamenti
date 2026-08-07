import { fillTemplate } from '../lib/fillTemplate'
import { buildTemplateContext } from '../lib/templateContext'
import { documentPersonType } from '../data/personTypes'
import { fullName } from '../lib/format'
import type { Course, DocumentRow, DocumentTemplate, Person, PersonType } from '../types/db'
import { uploadDocument } from './documents'

function toHtmlDocument(title: string, body: string): string {
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

function slugFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60)
}

export async function generateFromTemplate(input: {
  template: DocumentTemplate
  course?: Course | null
  person?: Person | null
  personType?: PersonType | null
}): Promise<DocumentRow> {
  const { template, course = null, person = null, personType = null } = input

  if (template.requires_course && !course) {
    throw new Error('Questo template richiede un corso')
  }
  if (template.person_role !== 'none' && !person) {
    throw new Error('Questo template richiede una persona')
  }
  if (
    template.person_role !== 'none' &&
    template.person_role !== 'any' &&
    personType &&
    personType !== template.person_role
  ) {
    throw new Error('Tipo persona non compatibile con il template')
  }

  const filled = fillTemplate(
    template.body,
    buildTemplateContext({ course, person, personType }),
  )

  const who = person ? fullName(person) : ''
  const courseBit = course ? course.name : ''
  const title = [template.name, who, courseBit].filter(Boolean).join(' — ')
  const fileName = `${slugFileName(title) || 'documento'}.html`
  const html = toHtmlDocument(title, filled)
  const file = new File([html], fileName, { type: 'text/html' })

  return uploadDocument({
    personType: person && personType ? documentPersonType(personType) : null,
    personId: person?.id ?? null,
    courseId: course?.id ?? null,
    category: template.default_category,
    title,
    templateId: template.id,
    file,
  })
}
