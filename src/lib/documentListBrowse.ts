import { categoryLabels } from '../data/documentCategories'
import { matchesSearch } from './matchesSearch'
import type { DocumentRow } from '../types/db'

export const documentSortKeys = ['name', 'category', 'date', 'size'] as const
export type DocumentSortKey = (typeof documentSortKeys)[number]
export type DocumentSortDir = 'asc' | 'desc'

export const DEFAULT_DOCUMENT_SORT: DocumentSortKey = 'date'
export const DEFAULT_DOCUMENT_SORT_DIR: DocumentSortDir = 'desc'

const SORT_LABELS: Record<DocumentSortKey, string> = {
  name: 'Nome file',
  category: 'Categoria',
  date: 'Data',
  size: 'Dimensione',
}

export function documentSortLabel(key: DocumentSortKey): string {
  return SORT_LABELS[key]
}

function displayName(doc: DocumentRow): string {
  return (doc.title || doc.file_name).trim()
}

function haystack(
  doc: DocumentRow,
  personLabel: string,
  courseLabel: string,
): string {
  return [
    doc.file_name,
    doc.title,
    categoryLabels[doc.category] ?? doc.category,
    personLabel,
    courseLabel,
  ]
    .filter(Boolean)
    .join(' ')
}

function compareDocs(
  a: DocumentRow,
  b: DocumentRow,
  key: DocumentSortKey,
  dir: DocumentSortDir,
): number {
  let n = 0
  switch (key) {
    case 'name':
      n = displayName(a).localeCompare(displayName(b), 'it')
      break
    case 'category':
      n = (categoryLabels[a.category] ?? a.category).localeCompare(
        categoryLabels[b.category] ?? b.category,
        'it',
      )
      break
    case 'date':
      n = a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
      break
    case 'size':
      n = a.size_bytes - b.size_bytes
      break
  }
  return dir === 'asc' ? n : -n
}

export function browseDocuments(
  docs: DocumentRow[],
  search: string,
  sortKey: DocumentSortKey,
  sortDir: DocumentSortDir,
  labels: {
    personLabel: (doc: DocumentRow) => string
    courseLabel: (doc: DocumentRow) => string
  },
): DocumentRow[] {
  const q = search.trim()
  let list = docs
  if (q) {
    list = docs.filter((doc) =>
      matchesSearch(
        haystack(doc, labels.personLabel(doc), labels.courseLabel(doc)),
        q,
      ),
    )
  }
  return [...list].sort((a, b) => compareDocs(a, b, sortKey, sortDir))
}
