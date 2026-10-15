import { supabase } from '../lib/supabase'
import { normalizePersonInput } from '../lib/normalizePersonInput'
import { cleanText } from '../lib/text'
import { deleteDocument, listDocuments } from './documents'
import type { EipassCandidate, EipassCandidateInput, PersonInput } from '../types/db'

const TABLE = 'eipass_candidates'

/** Le colonne numeric possono arrivare come stringa: le riporta a numero. */
function fromRow(row: EipassCandidate): EipassCandidate {
  return {
    ...row,
    amount: row.amount == null ? null : Number(row.amount),
    vat_rate: row.vat_rate == null ? 22 : Number(row.vat_rate),
  }
}

function normalizeInput<T extends Partial<EipassCandidateInput>>(input: T): T {
  // Stesse regole dell'anagrafica alunni/personale (Title Case, codici in maiuscolo, email)
  const out = normalizePersonInput(input as Partial<PersonInput>) as T
  if (typeof out.certification === 'string') out.certification = cleanText(out.certification)
  // L'esame non fatto non ha data
  if (out.exam_done === false) out.exam_date = null
  if (typeof out.invoice_number === 'string') out.invoice_number = out.invoice_number.trim()
  if (typeof out.amount === 'number' && !Number.isFinite(out.amount)) out.amount = null
  return out
}

export async function listEipassCandidates(): Promise<EipassCandidate[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('last_name')
    .order('first_name')
  if (error) throw error
  return (data as EipassCandidate[]).map(fromRow)
}

export async function getEipassCandidate(id: string): Promise<EipassCandidate> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
  if (error) throw error
  return fromRow(data as EipassCandidate)
}

export async function createEipassCandidate(
  input: EipassCandidateInput,
): Promise<EipassCandidate> {
  const { data, error } = await supabase.from(TABLE).insert(normalizeInput(input)).select().single()
  if (error) throw error
  return fromRow(data as EipassCandidate)
}

export async function updateEipassCandidate(
  id: string,
  input: Partial<EipassCandidateInput>,
): Promise<EipassCandidate> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(normalizeInput(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as EipassCandidate)
}

/** Elimina il corsista e i file caricati sulla sua scheda. */
export async function deleteEipassCandidate(id: string): Promise<void> {
  const docs = await listDocuments({ mode: 'person', personType: 'eipass', personId: id })
  for (const doc of docs) await deleteDocument(doc)
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
