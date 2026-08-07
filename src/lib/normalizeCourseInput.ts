import { cleanText, titleCase, upperCode } from './text'
import type { CourseInput } from '../types/db'

/** Normalizza l'input corso prima di insert/update. */
export function normalizeCourseInput<T extends Partial<CourseInput>>(input: T): T {
  const out: Partial<CourseInput> = { ...input }

  if (typeof out.name === 'string') out.name = titleCase(out.name)
  if (typeof out.edition === 'string') out.edition = cleanText(out.edition)
  if (typeof out.code === 'string') out.code = upperCode(out.code)
  if (typeof out.cup === 'string') out.cup = upperCode(out.cup)
  if (typeof out.notes === 'string') out.notes = out.notes.trim()

  return out as T
}
