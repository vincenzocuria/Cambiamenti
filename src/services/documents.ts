import { supabase } from '../lib/supabase'
import type { DocumentCategory, DocumentRow, PersonType } from '../types/db'

const BUCKET = 'documents'

export async function listDocuments(personType: PersonType, personId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('person_type', personType)
    .eq('person_id', personId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function uploadDocument(params: {
  personType: PersonType
  personId: string
  courseId: string | null
  category: DocumentCategory
  file: File
}): Promise<DocumentRow> {
  const { personType, personId, courseId, category, file } = params
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${personType}/${personId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
  })
  if (uploadError) throw uploadError

  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('documents')
    .insert({
      person_type: personType,
      person_id: personId,
      course_id: courseId,
      category,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: userData.user?.id ?? null,
    })
    .select()
    .single()
  if (error) {
    // Evita file orfani se l'insert fallisce
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
