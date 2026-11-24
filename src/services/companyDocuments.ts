import { supabase } from '../lib/supabase'
import {
  fileForDocumentUpload,
  formatDocumentUploadError,
  validateDocumentForUpload,
} from '../lib/documentFileTypes'
import type { CompanyDocument, CompanyDocumentInput } from '../lib/companyDocuments'

const BUCKET = 'documents'

export async function listCompanyDocuments(): Promise<CompanyDocument[]> {
  const { data, error } = await supabase.from('company_documents').select('*').limit(5000)
  if (error) throw error
  return (data ?? []) as CompanyDocument[]
}

/** Documenti della società collegati all'elenco master ISO 9001, per mostrarne il file nella Qualità. */
export async function listCompanyDocumentsForQuality(): Promise<CompanyDocument[]> {
  const { data, error } = await supabase
    .from('company_documents')
    .select('*')
    .not('quality_document_id', 'is', null)
    .is('superseded_at', null)
  if (error) throw error
  return (data ?? []) as CompanyDocument[]
}

export async function createCompanyDocument(
  input: CompanyDocumentInput & { replaces_id?: string | null; sort_order?: number },
): Promise<CompanyDocument> {
  const { data, error } = await supabase.from('company_documents').insert(input).select().single()
  if (error) throw error
  return data as CompanyDocument
}

export async function updateCompanyDocument(
  id: string,
  patch: Partial<CompanyDocumentInput> & { superseded_at?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('company_documents')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Carica (o sostituisce) il file della voce. Il file precedente viene cancellato. */
export async function uploadCompanyFile(doc: CompanyDocument, file: File): Promise<void> {
  const validated = await validateDocumentForUpload(file)
  if ('error' in validated) throw new Error(validated.error)
  const { contentType } = validated
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `company/${doc.id}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileForDocumentUpload(file, contentType), { contentType })
  if (uploadError) throw new Error(formatDocumentUploadError(uploadError, file.name))

  const { error } = await supabase
    .from('company_documents')
    .update({
      file_name: file.name,
      storage_path: path,
      mime_type: contentType,
      size_bytes: file.size,
      updated_at: new Date().toISOString(),
    })
    .eq('id', doc.id)
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path])
}

export async function companyFileUrl(doc: Pick<CompanyDocument, 'storage_path' | 'file_name'>, download = true): Promise<string> {
  if (!doc.storage_path) throw new Error('Nessun file caricato')
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 300, download ? { download: doc.file_name } : undefined)
  if (error) throw error
  return data.signedUrl
}

/**
 * Rinnovo: crea la nuova versione (stessi dati, date nuove) e segna la precedente come superata.
 * Il file della versione precedente resta, per lo storico.
 */
export async function renewCompanyDocument(old: CompanyDocument, input: CompanyDocumentInput): Promise<CompanyDocument> {
  const created = await createCompanyDocument({ ...input, replaces_id: old.id, sort_order: old.sort_order })
  await updateCompanyDocument(old.id, { superseded_at: new Date().toISOString() })
  return created
}

export async function deleteCompanyDocument(doc: CompanyDocument): Promise<void> {
  const { error } = await supabase.from('company_documents').delete().eq('id', doc.id)
  if (error) throw error
  if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path])
}
