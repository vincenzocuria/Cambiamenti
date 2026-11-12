import { supabase } from '../lib/supabase'
import type { ProtocolEntry, ProtocolInput } from '../lib/protocol'

const cols =
  'id, year, number, entry_date, direction, counterpart, subject, channel, external_ref, notes, course_id, document_id, pec_message_id, cancelled_at, cancelled_reason, created_at, course:courses(id, name, code, edition)'

export async function listProtocol(opts: { courseId?: string } = {}): Promise<ProtocolEntry[]> {
  let q = supabase.from('protocol_entries').select(cols).order('year', { ascending: false }).order('number', { ascending: false })
  if (opts.courseId) q = q.eq('course_id', opts.courseId)
  const { data, error } = await q.limit(5000)
  if (error) throw error
  return (data ?? []) as unknown as ProtocolEntry[]
}

/** Registra una voce con il prossimo numero libero dell'anno (o quello indicato). */
export async function registerProtocol(input: ProtocolInput): Promise<ProtocolEntry> {
  const { data, error } = await supabase.rpc('protocol_register', {
    p_entry_date: input.entry_date,
    p_direction: input.direction,
    p_counterpart: input.counterpart.trim(),
    p_subject: input.subject.trim(),
    p_channel: input.channel ?? 'PEC',
    p_external_ref: (input.external_ref ?? '').trim(),
    p_notes: (input.notes ?? '').trim(),
    p_course_id: input.course_id ?? null,
    p_document_id: input.document_id ?? null,
    p_pec_message_id: input.pec_message_id ?? null,
    p_number: input.number ?? null,
  })
  if (error) {
    if (/duplicate key|protocol_entries_year_number_key/i.test(error.message)) {
      throw new Error('Questo numero di protocollo è già usato per quell\'anno')
    }
    throw error
  }
  return data as ProtocolEntry
}

export async function updateProtocol(
  id: string,
  patch: Partial<
    Pick<ProtocolEntry, 'entry_date' | 'direction' | 'counterpart' | 'subject' | 'channel' | 'external_ref' | 'notes' | 'course_id' | 'document_id'>
  >,
): Promise<void> {
  const { error } = await supabase.from('protocol_entries').update(patch).eq('id', id)
  if (error) throw error
}

/** Un numero non si cancella: si annulla con il motivo (o si ripristina). */
export async function cancelProtocol(id: string, reason: string | null): Promise<void> {
  const { error } = await supabase
    .from('protocol_entries')
    .update(reason == null ? { cancelled_at: null, cancelled_reason: '' } : { cancelled_at: new Date().toISOString(), cancelled_reason: reason })
    .eq('id', id)
  if (error) throw error
}
