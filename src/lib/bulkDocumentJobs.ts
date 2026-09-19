import type { Course, DocumentRow, DocumentTemplate, Person, PersonType } from '../types/db'
import { fullName } from './format'
import { resolveTemplatePersonType } from './templateFits'

export type BulkDocumentJob = {
  template: DocumentTemplate
  person: Person | null
  personType: PersonType | null
}

export function buildBulkDocumentJobs(input: {
  templates: DocumentTemplate[]
  people: Person[]
  personType: PersonType | null
}): BulkDocumentJob[] {
  const jobs: BulkDocumentJob[] = []
  for (const template of input.templates) {
    if (template.person_role === 'none') {
      jobs.push({ template, person: null, personType: null })
      continue
    }
    for (const person of input.people) {
      jobs.push({
        template,
        person,
        personType: resolveTemplatePersonType(template, input.personType),
      })
    }
  }
  return jobs
}

export function jobAlreadyGenerated(
  docs: DocumentRow[],
  job: BulkDocumentJob,
  courseId: string,
): boolean {
  return docs.some(
    (d) =>
      d.template_id === job.template.id &&
      d.course_id === courseId &&
      (job.person ? d.person_id === job.person.id : !d.person_id),
  )
}

export function filterBulkJobs(input: {
  jobs: BulkDocumentJob[]
  course: Course
  existingDocs: DocumentRow[]
  skipExisting: boolean
}): BulkDocumentJob[] {
  if (!input.skipExisting) return input.jobs
  return input.jobs.filter((job) => !jobAlreadyGenerated(input.existingDocs, job, input.course.id))
}

export function jobPersonLabel(job: BulkDocumentJob): string {
  return job.person ? fullName(job.person) : 'corso'
}
