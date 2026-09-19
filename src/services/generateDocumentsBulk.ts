import type { Course, DocumentRow } from '../types/db'
import { jobPersonLabel, type BulkDocumentJob } from '../lib/bulkDocumentJobs'
import { generateFromTemplate } from './generateDocument'

export type BulkItemResult = {
  templateName: string
  personName: string
  status: 'ok' | 'error'
  error?: string
  document?: DocumentRow
}

export type BulkGenerateResult = {
  ok: number
  failed: number
  items: BulkItemResult[]
}

export async function generateDocumentsBulk(input: {
  course?: Course | null
  jobs: BulkDocumentJob[]
  onProgress?: (done: number, total: number, item: BulkItemResult) => void
}): Promise<BulkGenerateResult> {
  const items: BulkItemResult[] = []
  let ok = 0
  let failed = 0

  for (const job of input.jobs) {
    const personName = jobPersonLabel(job)
    let item: BulkItemResult
    try {
      const document = await generateFromTemplate({
        template: job.template,
        course: input.course ?? null,
        person: job.person,
        personType: job.personType,
      })
      item = { templateName: job.template.name, personName, status: 'ok', document }
      ok += 1
    } catch (err) {
      item = {
        templateName: job.template.name,
        personName,
        status: 'error',
        error: err instanceof Error ? err.message : 'Generazione fallita',
      }
      failed += 1
    }
    items.push(item)
    input.onProgress?.(items.length, input.jobs.length, item)
  }

  return { ok, failed, items }
}
