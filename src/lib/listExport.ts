import { exportExcel } from './exportExcel'
import { exportPdf } from './exportPdf'

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string
}

export function exportRows<T>(
  rows: T[],
  columns: ExportColumn<T>[],
): { headers: string[]; rows: string[][] } {
  return {
    headers: columns.map((c) => c.header),
    rows: rows.map((row) => columns.map((c) => c.value(row))),
  }
}

/** Excel e PDF dello stesso elenco filtrato. */
export function exportFilteredList<T>(opts: {
  title: string
  rows: T[]
  columns: ExportColumn<T>[]
  filters?: string
  format: 'excel' | 'pdf'
}): void {
  const table = exportRows(opts.rows, opts.columns)
  if (opts.format === 'excel') {
    exportExcel({ title: opts.title, ...table })
    return
  }
  exportPdf({ title: opts.title, filters: opts.filters, ...table })
}

export function describeFilters(parts: Array<string | false | undefined>): string {
  const labels = parts.filter((p): p is string => Boolean(p))
  return labels.length ? labels.join(' · ') : 'nessun filtro'
}
