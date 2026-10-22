import type { DocumentCategory } from '../types/db'

export const categoryLabels: Record<DocumentCategory, string> = {
  identity: "Documento d'identità",
  curriculum: 'Curriculum',
  module: 'Modulo',
  appointment: "Lettera d'incarico",
  certificate: 'Attestato',
  other: 'Altro',
  generated: 'Generato da template',
  report: 'Verbale',
  declaration: 'Autodichiarazione',
}

export const categoryOptions: { value: DocumentCategory; label: string }[] = [
  { value: 'identity', label: categoryLabels.identity },
  { value: 'curriculum', label: categoryLabels.curriculum },
  { value: 'module', label: categoryLabels.module },
  { value: 'appointment', label: categoryLabels.appointment },
  { value: 'certificate', label: categoryLabels.certificate },
  { value: 'report', label: categoryLabels.report },
  { value: 'declaration', label: categoryLabels.declaration },
  { value: 'other', label: categoryLabels.other },
  { value: 'generated', label: categoryLabels.generated },
]
