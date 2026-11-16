import { supabase } from '../lib/supabase'
import {
  fileForDocumentUpload,
  formatDocumentUploadError,
  validateDocumentForUpload,
} from '../lib/documentFileTypes'
import type {
  Certificate,
  QualityDocument,
  QualityDocumentInput,
  Survey,
  SurveyResponse,
} from '../lib/quality'

const BUCKET = 'documents'

// --- Elenco master documenti ------------------------------------------------------------------

export async function listQualityDocuments(): Promise<QualityDocument[]> {
  const { data, error } = await supabase.from('quality_documents').select('*').limit(2000)
  if (error) throw error
  return (data ?? []) as QualityDocument[]
}

export async function createQualityDocument(input: QualityDocumentInput): Promise<QualityDocument> {
  const { data, error } = await supabase.from('quality_documents').insert(input).select().single()
  if (error) throw error
  return data as QualityDocument
}

export async function updateQualityDocument(id: string, patch: Partial<QualityDocumentInput>): Promise<void> {
  const { error } = await supabase
    .from('quality_documents')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Carica (o sostituisce) il file del documento; se era «da predisporre» passa a «vigente». */
export async function uploadQualityFile(doc: QualityDocument, file: File): Promise<void> {
  const validated = await validateDocumentForUpload(file)
  if ('error' in validated) throw new Error(validated.error)
  const { contentType } = validated
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `quality/${doc.id}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileForDocumentUpload(file, contentType), { contentType })
  if (uploadError) throw new Error(formatDocumentUploadError(uploadError, file.name))

  const { error } = await supabase
    .from('quality_documents')
    .update({
      file_name: file.name,
      storage_path: path,
      mime_type: contentType,
      size_bytes: file.size,
      status: doc.status === 'da_predisporre' ? 'vigente' : doc.status,
      issued_on: doc.issued_on ?? new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', doc.id)
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  // la versione precedente non serve più: il file nuovo la sostituisce
  if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path])
}

export async function qualityFileUrl(doc: QualityDocument, download = true): Promise<string> {
  if (!doc.storage_path) throw new Error('Nessun file caricato')
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 300, download ? { download: doc.file_name } : undefined)
  if (error) throw error
  return data.signedUrl
}

export async function deleteQualityDocument(doc: QualityDocument): Promise<void> {
  const { error } = await supabase.from('quality_documents').delete().eq('id', doc.id)
  if (error) throw error
  if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path])
}

// --- Registro attestati -----------------------------------------------------------------------

const certCols =
  'id, year, number, issued_on, course_id, student_id, holder_name, holder_tax_code, title, hours, outcome, delivered_on, delivery_method, document_id, notes, cancelled_at, cancelled_reason, created_at, course:courses(id, name, code, edition)'

export async function listCertificates(opts: { courseId?: string } = {}): Promise<Certificate[]> {
  let q = supabase
    .from('certificates')
    .select(certCols)
    .order('year', { ascending: false })
    .order('number', { ascending: false })
  if (opts.courseId) q = q.eq('course_id', opts.courseId)
  const { data, error } = await q.limit(5000)
  if (error) throw error
  return (data ?? []) as unknown as Certificate[]
}

export async function issueCertificates(input: {
  courseId: string
  studentIds: string[]
  issuedOn: string
  title: string
  hours: number | null
  outcome: string
}): Promise<Certificate[]> {
  const { data, error } = await supabase.rpc('certificates_issue', {
    p_course_id: input.courseId,
    p_student_ids: input.studentIds,
    p_issued_on: input.issuedOn,
    p_title: input.title.trim(),
    p_hours: input.hours,
    p_outcome: input.outcome.trim(),
  })
  if (error) throw error
  return (data ?? []) as Certificate[]
}

export async function updateCertificate(
  id: string,
  patch: Partial<Pick<Certificate, 'delivered_on' | 'delivery_method' | 'notes' | 'outcome' | 'hours' | 'document_id'>>,
): Promise<void> {
  const { error } = await supabase.from('certificates').update(patch).eq('id', id)
  if (error) throw error
}

export async function markCertificatesDelivered(ids: string[], on: string, method: string): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase
    .from('certificates')
    .update({ delivered_on: on, delivery_method: method })
    .in('id', ids)
  if (error) throw error
}

/** Un numero non si cancella: si annulla con il motivo (o si ripristina). */
export async function cancelCertificate(id: string, reason: string | null): Promise<void> {
  const { error } = await supabase
    .from('certificates')
    .update(
      reason == null
        ? { cancelled_at: null, cancelled_reason: '' }
        : { cancelled_at: new Date().toISOString(), cancelled_reason: reason },
    )
    .eq('id', id)
  if (error) throw error
}

// --- Questionari ------------------------------------------------------------------------------

export async function listSurveys(courseId?: string): Promise<Survey[]> {
  let q = supabase.from('surveys').select('*').order('created_at', { ascending: false })
  if (courseId) q = q.eq('course_id', courseId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Survey[]
}

export async function createSurvey(courseId: string, closesOn: string | null): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .insert({ course_id: courseId, closes_on: closesOn })
    .select()
    .single()
  if (error) throw error
  return data as Survey
}

export async function setSurveyClosed(id: string, closed: boolean): Promise<void> {
  const { error } = await supabase
    .from('surveys')
    .update({ closed_at: closed ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function listSurveyResponses(surveyIds: string[]): Promise<SurveyResponse[]> {
  if (!surveyIds.length) return []
  const { data, error } = await supabase
    .from('survey_responses')
    .select('*')
    .in('survey_id', surveyIds)
    .order('submitted_at', { ascending: true })
    .limit(10000)
  if (error) throw error
  return (data ?? []) as SurveyResponse[]
}

export interface PublicSurvey {
  course_name: string
  edition: string | null
  code: string | null
  start_date: string | null
  end_date: string | null
  open: boolean
  teachers: { id: string; name: string }[]
}

/** Per la pagina pubblica: funziona anche senza login. */
export async function getPublicSurvey(token: string): Promise<PublicSurvey | null> {
  const { data, error } = await supabase.rpc('survey_public', { p_token: token })
  if (error) throw error
  return (data as PublicSurvey | null) ?? null
}

export async function submitPublicSurvey(input: {
  token: string
  scores: Record<string, number>
  teacherScores: Record<string, number>
  liked: string
  suggestions: string
}): Promise<void> {
  const { error } = await supabase.rpc('survey_submit', {
    p_token: input.token,
    p_scores: input.scores,
    p_teacher_scores: input.teacherScores,
    p_liked: input.liked.trim(),
    p_suggestions: input.suggestions.trim(),
  })
  if (error) throw new Error(error.message || 'Invio non riuscito')
}

/** Nomi del personale per id (per i punteggi dei docenti nei questionari). */
export async function listPeopleNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map
  const { data, error } = await supabase.from('people').select('id, first_name, last_name').in('id', ids)
  if (error) throw error
  for (const p of data ?? []) map.set(p.id, `${p.last_name} ${p.first_name}`.trim())
  return map
}
