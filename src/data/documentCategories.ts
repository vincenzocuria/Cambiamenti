import type { DocumentCategory } from '../types/db'

export const categoryLabels: Record<DocumentCategory, string> = {
  identity: "Documento d'identità",
  curriculum: 'Curriculum',
  module: 'Modulo',
  appointment: "Lettera d'incarico",
  other: 'Altro',
  generated: 'Generato da template',
}

export const categoryOptions: { value: DocumentCategory; label: string }[] = [
  { value: 'identity', label: categoryLabels.identity },
  { value: 'curriculum', label: categoryLabels.curriculum },
  { value: 'module', label: categoryLabels.module },
  { value: 'appointment', label: categoryLabels.appointment },
  { value: 'other', label: categoryLabels.other },
  { value: 'generated', label: categoryLabels.generated },
]
