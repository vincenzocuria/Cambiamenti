import { supabase } from '../lib/supabase'

export type PecStatus = 'nuova' | 'elaborata' | 'da_verificare' | 'ignorata' | 'verificata'

export interface PecAttachmentRow {
  id: string
  file_name: string
  size_bytes: number
  storage_path: string | null
  document_id: string | null
}

export interface PecMessageRow {
  id: string
  mailbox: string
  direction: 'in' | 'out'
  from_address: string
  to_addresses: string
  subject: string
  sent_at: string | null
  body_text: string
  status: PecStatus
  claude_note: string
  course_ids: string[]
  processed_at: string | null
  pec_attachments: PecAttachmentRow[]
}

export interface PecCourseRef {
  id: string
  name: string
  edition: string
}

/** PEC per stato (le più recenti prima) con i corsi collegati. */
export async function fetchPecMessages(status: PecStatus | 'tutte', limit = 100): Promise<{ rows: PecMessageRow[]; courses: Map<string, PecCourseRef> }> {
  let q = supabase
    .from('pec_messages')
    .select('id, mailbox, direction, from_address, to_addresses, subject, sent_at, body_text, status, claude_note, course_ids, processed_at, pec_attachments(id, file_name, size_bytes, storage_path, document_id)')
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (status !== 'tutte') q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as PecMessageRow[]
  const ids = [...new Set(rows.flatMap((r) => r.course_ids ?? []))]
  const courses = new Map<string, PecCourseRef>()
  if (ids.length) {
    const res = await supabase.from('courses').select('id, name, edition').in('id', ids)
    if (res.error) throw res.error
    for (const c of res.data as PecCourseRef[]) courses.set(c.id, c)
  }
  return { rows, courses }
}

/** Numero di PEC per stato (per i filtri). */
export async function countPecByStatus(): Promise<Record<PecStatus, number>> {
  const statuses: PecStatus[] = ['nuova', 'elaborata', 'da_verificare', 'ignorata', 'verificata']
  const results = await Promise.all(
    statuses.map((s) => supabase.from('pec_messages').select('id', { count: 'exact', head: true }).eq('status', s)),
  )
  const out = {} as Record<PecStatus, number>
  statuses.forEach((s, i) => (out[s] = results[i].count ?? 0))
  return out
}

export async function setPecStatus(id: string, status: PecStatus): Promise<void> {
  const { error } = await supabase.from('pec_messages').update({ status }).eq('id', id)
  if (error) throw error
}

export async function pecAttachmentUrl(a: PecAttachmentRow): Promise<string> {
  if (!a.storage_path) throw new Error('Allegato non disponibile')
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(a.storage_path, 300)
  if (error) throw error
  return data.signedUrl
}
