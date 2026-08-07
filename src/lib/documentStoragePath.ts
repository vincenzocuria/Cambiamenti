import type { PersonType } from '../types/db'

export function buildDocumentStoragePath(input: {
  personType?: PersonType | null
  personId?: string | null
  courseId?: string | null
  fileName: string
}): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const id = crypto.randomUUID()
  if (input.personType && input.personId && input.courseId) {
    return `${input.personType}/${input.personId}/course/${input.courseId}/${id}-${safeName}`
  }
  if (input.personType && input.personId) {
    return `${input.personType}/${input.personId}/${id}-${safeName}`
  }
  if (input.courseId) {
    return `course/${input.courseId}/${id}-${safeName}`
  }
  throw new Error('Serve almeno una persona o un corso per salvare il documento')
}
