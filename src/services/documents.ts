import { supabase } from '../lib/supabase'
import { buildDocumentStoragePath } from '../lib/documentStoragePath'
import type { DocumentCategory, DocumentRow, PersonType } from '../types/db'

const BUCKET = 'documents'

export type DocumentFilter =
  | { mode: 'person'; personType: PersonType; personId: string }
  | { mode: 'course'; courseId: string }

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

  const path = buildDocumentStoragePath({
    personType,
    personId,
    courseId,
    fileName: file.name,
  })

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
  })
  if (uploadError) throw uploadError

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
      mime_type: file.type,
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

export async function getDownloadUrl(doc: DocumentRow): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 300, { download: doc.file_name })
  if (error) throw error
  return data.signedUrl
}

export async function deleteDocument(doc: DocumentRow): Promise<void> {
  const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id)
  if (dbError) throw dbError
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path])
  if (storageError) throw storageError
}
