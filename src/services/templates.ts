import { supabase } from '../lib/supabase'
import type { DocumentTemplate, DocumentTemplateInput } from '../types/db'
import { ensureGolTemplates } from './seedGolTemplates'

export async function listTemplates(): Promise<DocumentTemplate[]> {
  await ensureGolTemplates()
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function getTemplate(id: string): Promise<DocumentTemplate> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createTemplate(input: DocumentTemplateInput): Promise<DocumentTemplate> {
  const { data, error } = await supabase.from('document_templates').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateTemplate(
  id: string,
  input: DocumentTemplateInput,
): Promise<DocumentTemplate> {
  const { data, error } = await supabase
    .from('document_templates')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('document_templates').delete().eq('id', id)
  if (error) throw error
}
