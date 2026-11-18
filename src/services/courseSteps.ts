import { supabase } from '../lib/supabase'
import type { Course, DocumentTemplate } from '../types/db'
import { ensureGolTemplates } from './seedGolTemplates'
import { generateFromTemplate } from './generateDocument'
import { iterRows, type CourseStep, type CourseStepStatus, type IterModel } from '../lib/courseIter'

export async function listCourseSteps(courseId: string): Promise<CourseStep[]> {
  const { data, error } = await supabase
    .from('course_steps')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as CourseStep[]
}

/** Crea i passi del modello che il corso non ha ancora (non tocca quelli esistenti). */
export async function createCourseIter(
  courseId: string,
  model: IterModel,
  startDate: string | null,
  endDate: string | null,
): Promise<void> {
  const existing = await listCourseSteps(courseId)
  const have = new Set(existing.map((s) => s.step_key).filter(Boolean))
  const rows = iterRows(model, courseId, startDate, endDate).filter((r) => !have.has(r.step_key))
  if (!rows.length) return
  const { error } = await supabase.from('course_steps').insert(rows)
  if (error) throw error
}

export async function addCourseStep(courseId: string, title: string, sortOrder: number, dueOn: string | null): Promise<void> {
  const { error } = await supabase
    .from('course_steps')
    .insert({ course_id: courseId, title, sort_order: sortOrder, due_on: dueOn })
  if (error) throw error
}

export async function updateCourseStep(
  id: string,
  patch: Partial<Pick<CourseStep, 'title' | 'status' | 'due_on' | 'done_on' | 'notes' | 'sort_order' | 'manual'>>,
): Promise<void> {
  const { error } = await supabase.from('course_steps').update(patch).eq('id', id)
  if (error) throw error
}

/** Stato scelto a mano: da quel momento vince sul riconoscimento automatico. */
export function setCourseStepStatus(step: CourseStep, status: CourseStepStatus, today: string): Promise<void> {
  return updateCourseStep(step.id, { status, manual: true, done_on: status === 'fatto' ? (step.done_on ?? today) : null })
}

/** Torna a far decidere il gestionale dai dati e dai documenti. */
export function resetCourseStepAuto(step: CourseStep): Promise<void> {
  return updateCourseStep(step.id, { status: 'da_fare', manual: false, done_on: null })
}

/** Genera la lettera del passo dal modello e la collega al passo. */
export async function generateStepDocument(step: CourseStep, templateName: string, course: Course): Promise<void> {
  await ensureGolTemplates()
  const { data, error } = await supabase.from('document_templates').select('*').eq('name', templateName).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Modello «${templateName}» non trovato in Modelli`)
  const doc = await generateFromTemplate({ template: data as DocumentTemplate, course, title: `${templateName} — ${course.name}` })
  await linkStepDocument(step.id, doc.id)
}

export async function deleteCourseStep(id: string): Promise<void> {
  const { error } = await supabase.from('course_steps').delete().eq('id', id)
  if (error) throw error
}

/** Per ogni passo del corso, i documenti collegati. */
export async function listStepDocuments(stepIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!stepIds.length) return out
  const { data, error } = await supabase
    .from('course_step_documents')
    .select('step_id, document_id, created_at')
    .in('step_id', stepIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  for (const r of data ?? []) {
    const k = r.step_id as string
    out.set(k, [...(out.get(k) ?? []), r.document_id as string])
  }
  return out
}

export async function linkStepDocument(stepId: string, documentId: string): Promise<void> {
  const { error } = await supabase
    .from('course_step_documents')
    .upsert({ step_id: stepId, document_id: documentId }, { onConflict: 'step_id,document_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function unlinkStepDocument(stepId: string, documentId: string): Promise<void> {
  const { error } = await supabase.from('course_step_documents').delete().eq('step_id', stepId).eq('document_id', documentId)
  if (error) throw error
}

/** Quante giornate FAD ha il corso (per il passo delle presenze). */
export async function countFadDays(courseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('fad_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
  if (error) return 0
  return count ?? 0
}

export async function countLessons(courseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('calendar_events')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
  if (error) return 0
  return count ?? 0
}
