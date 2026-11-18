import { supabase } from '../lib/supabase'
import {
  COCOCO_TEMPLATE_NAME,
  contractTitle,
  type CollaborationContract,
  type ContractInput,
} from '../lib/collaborationContract'
import { golTemplateSeeds } from '../data/golTemplates'
import type { DocumentRow, DocumentTemplate, Person } from '../types/db'
import { getPreviewUrl, uploadDocument } from './documents'
import { generateFromTemplate } from './generateDocument'
import { ensureGolTemplates } from './seedGolTemplates'

const cols = '*, person:people(id, first_name, last_name, tax_code)'

export async function listContracts(opts: { personId?: string } = {}): Promise<CollaborationContract[]> {
  let q = supabase.from('collaboration_contracts').select(cols).order('start_date', { ascending: false })
  if (opts.personId) q = q.eq('person_id', opts.personId)
  const { data, error } = await q.limit(2000)
  if (error) throw error
  return (data ?? []) as unknown as CollaborationContract[]
}

function clean(input: ContractInput): ContractInput {
  return {
    ...input,
    end_date: input.end_date || null,
    signed_on: input.signed_on || null,
    extra_activities: input.extra_activities.trim(),
    courses_text: input.courses_text.trim(),
    location: input.location.trim(),
    payment_terms: input.payment_terms.trim(),
    privacy_role: input.privacy_role.trim(),
    notes: input.notes.trim(),
  }
}

export async function createContract(input: ContractInput): Promise<CollaborationContract> {
  const { data, error } = await supabase.from('collaboration_contracts').insert(clean(input)).select(cols).single()
  if (error) throw error
  return data as unknown as CollaborationContract
}

export async function updateContract(
  id: string,
  patch: Partial<ContractInput> & { signed_document_id?: string | null; generated_document_id?: string | null },
): Promise<CollaborationContract> {
  const { data, error } = await supabase.from('collaboration_contracts').update(patch).eq('id', id).select(cols).single()
  if (error) throw error
  return data as unknown as CollaborationContract
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('collaboration_contracts').delete().eq('id', id)
  if (error) throw error
}

async function cococoTemplate(): Promise<DocumentTemplate> {
  await ensureGolTemplates()
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('name', COCOCO_TEMPLATE_NAME)
    .maybeSingle()
  if (error) throw error
  if (data) return data as DocumentTemplate
  // Modello rinominato o cancellato in «Template»: lo ricrea dal testo di base
  const seed = golTemplateSeeds.find((t) => t.name === COCOCO_TEMPLATE_NAME)!
  const { data: created, error: insertError } = await supabase.from('document_templates').insert(seed).select().single()
  if (insertError) throw insertError
  return created as DocumentTemplate
}

/** Genera il contratto dal modello (testo modificabile in «Template») e lo salva tra i documenti della persona. */
export async function generateContractDocument(
  contract: CollaborationContract,
  person: Person,
): Promise<{ contract: CollaborationContract; document: DocumentRow }> {
  const template = await cococoTemplate()
  const document = await generateFromTemplate({
    template,
    person,
    personType: 'staff',
    contract,
    title: `${contractTitle({ ...contract, person })} (da firmare)`,
  })
  const updated = await updateContract(contract.id, { generated_document_id: document.id })
  return { contract: updated, document }
}

/** Carica la scansione firmata, la collega al contratto e lo segna come firmato. */
export async function attachSignedContract(
  contract: CollaborationContract,
  file: File,
): Promise<CollaborationContract> {
  const document = await uploadDocument({
    personType: 'staff',
    personId: contract.person_id,
    category: 'appointment',
    title: `${contractTitle(contract)} (firmato)`,
    file,
  })
  return updateContract(contract.id, {
    signed_document_id: document.id,
    status: contract.status === 'bozza' ? 'firmato' : contract.status,
  })
}

/** Apre in una nuova scheda un documento collegato al contratto (firmato o generato). */
export async function openContractDocument(documentId: string): Promise<void> {
  const win = window.open('', '_blank')
  const { data, error } = await supabase.from('documents').select('*').eq('id', documentId).single()
  if (error) {
    win?.close()
    throw error
  }
  const url = await getPreviewUrl(data as DocumentRow)
  if (win) win.location.href = url
  else window.location.href = url
}
