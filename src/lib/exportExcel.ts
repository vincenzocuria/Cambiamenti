import { datedFileName, downloadBlob } from './downloadBlob'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sheetName(title: string): string {
  const raw = title.replace(/[:\\/?*[\]]/g, ' ').trim() || 'Elenco'
  return raw.slice(0, 31)
}

/** Esporta una tabella in Excel (SpreadsheetML .xls). */
export function exportExcel(opts: {
  title: string
  headers: string[]
  rows: string[][]
}): void {
  const cells = (values: string[], type: 'String' | 'Number' = 'String') =>
    values
      .map((v) => `<Cell><Data ss:Type="${type}">${escapeXml(v)}</Data></Cell>`)
      .join('')

  const headerRow = `<Row>${cells(opts.headers)}</Row>`
  const body = opts.rows.map((row) => `<Row>${cells(row)}</Row>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${escapeXml(sheetName(opts.title))}">
    <Table>
      ${headerRow}
      ${body}
    </Table>
  </Worksheet>
</Workbook>`

  downloadBlob(
    new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    datedFileName(opts.title, 'xls'),
  )
}
