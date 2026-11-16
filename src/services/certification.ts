import { supabase } from '../lib/supabase'
import {
  fileForDocumentUpload,
  formatDocumentUploadError,
  validateDocumentForUpload,
} from '../lib/documentFileTypes'
import type {
  Certification,
  CertificationFile,
  CertificationFileCategory,
  CertificationInput,
  CertificationStep,
  StepStatus,
} from '../lib/certification'

const BUCKET = 'documents'

export async function listCertifications(): Promise<Certification[]> {
  const { data, error } = await supabase.from('certifications').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Certification[]
}

export async function updateCertification(id: string, patch: Partial<CertificationInput>): Promise<void> {
  const { error } = await supabase
    .from('certifications')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function listSteps(certificationId: string): Promise<CertificationStep[]> {
  const { data, error } = await supabase.from('certification_steps').select('*').eq('certification_id', certificationId)
  if (error) throw error
  return (data ?? []) as CertificationStep[]
}

export async function addStep(certificationId: string, title: string, sortOrder: number, dueOn: string | null): Promise<void> {
  const { error } = await supabase
    .from('certification_steps')
    .insert({ certification_id: certificationId, title, sort_order: sortOrder, due_on: dueOn })
  if (error) throw error
}

export async function updateStep(
  id: string,
  patch: Partial<Pick<CertificationStep, 'title' | 'status' | 'due_on' | 'done_on' | 'notes' | 'sort_order'>>,
): Promise<void> {
  const { error } = await supabase.from('certification_steps').update(patch).eq('id', id)
  if (error) throw error
}

export function setStepStatus(step: CertificationStep, status: StepStatus, today: string): Promise<void> {
  return updateStep(step.id, { status, done_on: status === 'fatto' ? (step.done_on ?? today) : null })
}

export async function deleteStep(id: string): Promise<void> {
  const { error } = await supabase.from('certification_steps').delete().eq('id', id)
  if (error) throw error
}

export async function listCertificationFiles(certificationId: string): Promise<CertificationFile[]> {
  const { data, error } = await supabase
    .from('certification_files')
    .select('*')
    .eq('certification_id', certificationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CertificationFile[]
}

export async function uploadCertificationFile(input: {
  certificationId: string
  stepId: string | null
  category: CertificationFileCategory
  title: string
  docDate: string | null
  notes: string
  file: File
}): Promise<void> {
  const validated = await validateDocumentForUpload(input.file)
  if ('error' in validated) throw new Error(validated.error)
  const { contentType } = validated
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `certification/${input.certificationId}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileForDocumentUpload(input.file, contentType), { contentType })
  if (uploadError) throw new Error(formatDocumentUploadError(uploadError, input.file.name))
  const { error } = await supabase.from('certification_files').insert({
    certification_id: input.certificationId,
    step_id: input.stepId,
    category: input.category,
    title: input.title.trim() || input.file.name,
    doc_date: input.docDate,
    notes: input.notes.trim(),
    file_name: input.file.name,
    storage_path: path,
    mime_type: contentType,
    size_bytes: input.file.size,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
}

export async function certificationFileUrl(f: CertificationFile, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(f.storage_path, 300, download ? { download: f.file_name } : undefined)
  if (error) throw error
  return data.signedUrl
}

export async function deleteCertificationFile(f: CertificationFile): Promise<void> {
  const { error } = await supabase.from('certification_files').delete().eq('id', f.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([f.storage_path])
}
