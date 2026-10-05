import { supabase } from '../lib/supabase'
import {
  fileForDocumentUpload,
  formatDocumentUploadError,
  validateDocumentForUpload,
} from '../lib/documentFileTypes'
import { buildDocumentStoragePath } from '../lib/documentStoragePath'
import type { DocumentCategory, DocumentRow, PersonType } from '../types/db'

const BUCKET = 'documents'

export type DocumentFilter =
  | { mode: 'person'; personType: PersonType; personId: string }
  | { mode: 'course'; courseId: string }

/** Alunni che hanno già almeno un file in categoria documento d'identità. */
export async function listStudentIdsWithIdentityFile(): Promise<Set<string>> {
  const ids = new Set<string>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('documents')
      .select('person_id')
      .eq('person_type', 'student')
      .eq('category', 'identity')
      .not('person_id', 'is', null)
      .range(from, from + pageSize - 1)
    if (error) throw error
    for (const row of data) {
      if (row.person_id) ids.add(row.person_id)
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return ids
}

export async function hasIdentityDocument(
  personType: PersonType,
  personId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('person_type', personType)
    .eq('person_id', personId)
    .eq('category', 'identity')
  if (error) throw error
  return (count ?? 0) > 0
}

export async function listDocuments(filter: DocumentFilter): Promise<DocumentRow[]> {
  let query = supabase.from('documents').select('*').order('created_at', { ascending: false })
  if (filter.mode === 'person') {
    query = query.eq('person_type', filter.personType).eq('person_id', filter.personId)
  } else {
    query = query.eq('course_id', filter.courseId)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function uploadDocument(params: {
  personType?: PersonType | null
  personId?: string | null
  courseId?: string | null
  category: DocumentCategory
  title?: string
  templateId?: string | null
  file: File
}): Promise<DocumentRow> {
  const {
    personType = null,
    personId = null,
    courseId = null,
    category,
    title = '',
    templateId = null,
    file,
  } = params

  if (!personId && !courseId) throw new Error('Indica almeno una persona o un corso')

  const validated = await validateDocumentForUpload(file)
  if ('error' in validated) throw new Error(validated.error)
  const { contentType } = validated

  const uploadFile = fileForDocumentUpload(file, contentType)

  const path = buildDocumentStoragePath({
    personType,
    personId,
    courseId,
    fileName: file.name,
  })

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, uploadFile, {
    contentType,
  })
  if (uploadError) {
    throw new Error(formatDocumentUploadError(uploadError, file.name))
  }

  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('documents')
    .insert({
      person_type: personId ? personType : null,
      person_id: personId,
      course_id: courseId,
      category,
      title: title || file.name,
      template_id: templateId,
      file_name: file.name,
      storage_path: path,
      mime_type: contentType,
      size_bytes: file.size,
      uploaded_by: userData.user?.id ?? null,
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  return data
}

async function signedDocumentUrl(doc: DocumentRow, download: boolean): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(
    doc.storage_path,
    300,
    download ? { download: doc.file_name } : undefined,
  )
  if (error) throw error
  return data.signedUrl
}

export function getDownloadUrl(doc: DocumentRow): Promise<string> {
  return signedDocumentUrl(doc, true)
}

/** Link firmato senza Content-Disposition di download, per l'anteprima nel browser. */
export function getPreviewUrl(doc: DocumentRow): Promise<string> {
  return signedDocumentUrl(doc, false)
}

export async function deleteDocument(doc: DocumentRow): Promise<void> {
  const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id)
  if (dbError) throw dbError
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path])
  if (storageError) throw storageError
}
