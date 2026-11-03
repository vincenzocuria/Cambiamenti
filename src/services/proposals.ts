import { supabase } from '../lib/supabase'
import { buildDocumentStoragePath } from '../lib/documentStoragePath'
import { COURSE_FIELDS, appendDatedNote, type ProposalRow, type ProposalStatus } from '../lib/proposals'

export interface ProposalWithRefs extends ProposalRow {
  course: { id: string; name: string; edition: string } | null
  pec: { id: string; subject: string; sent_at: string | null; from_address: string } | null
}

type Joined = ProposalRow & {
  courses: ProposalWithRefs['course'] | ProposalWithRefs['course'][]
  pec_messages: ProposalWithRefs['pec'] | ProposalWithRefs['pec'][]
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

export async function fetchProposals(status: ProposalStatus | 'tutte'): Promise<ProposalWithRefs[]> {
  let q = supabase
    .from('proposals')
    .select('*, courses(id, name, edition), pec_messages(id, subject, sent_at, from_address)')
    .order('created_at', { ascending: status === 'proposta' })
    .limit(200)
  if (status !== 'tutte') q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as Joined[]).map(({ courses, pec_messages, ...p }) => ({ ...p, course: one(courses), pec: one(pec_messages) }))
}

/** Proposte collegate a queste PEC, raggruppate per PEC. */
export async function fetchProposalsForPec(pecIds: string[]): Promise<Map<string, ProposalWithRefs[]>> {
  const out = new Map<string, ProposalWithRefs[]>()
  if (!pecIds.length) return out
  const { data, error } = await supabase
    .from('proposals')
    .select('*, courses(id, name, edition), pec_messages(id, subject, sent_at, from_address)')
    .in('pec_message_id', pecIds)
    .order('created_at')
  if (error) throw error
  for (const { courses, pec_messages, ...p } of (data ?? []) as Joined[]) {
    const row = { ...p, course: one(courses), pec: one(pec_messages) }
    const list = out.get(String(p.pec_message_id)) ?? []
    list.push(row)
    out.set(String(p.pec_message_id), list)
  }
  return out
}

export async function countPendingProposals(): Promise<number> {
  const { count, error } = await supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'proposta')
  if (error) return 0
  return count ?? 0
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

async function finish(id: string, status: ProposalStatus, result: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({ status, result, decided_by: await currentUserId(), decided_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

function pick(payload: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((f) => payload[f] !== undefined).map((f) => [f, payload[f]]))
}

function requireCourse(p: ProposalRow): string {
  if (!p.course_id) throw new Error('Proposta senza corso')
  return p.course_id
}

/** Esegue la modifica proposta con l'utente collegato. Restituisce un riepilogo. */
async function apply(p: ProposalRow): Promise<string> {
  const pl = p.payload ?? {}
  switch (p.kind) {
    case 'crea_corso': {
      const fields = pick(pl, COURSE_FIELDS)
      const { data: dup } = await supabase
        .from('courses')
        .select('id')
        .ilike('name', String(fields.name ?? ''))
        .ilike('edition', String(fields.edition ?? ''))
        .limit(1)
      if (dup?.length) throw new Error('Esiste già un corso con questo nome ed edizione')
      const { data, error } = await supabase
        .from('courses')
        .insert({ ...fields, status: fields.status ?? 'bozza', notes: fields.notes ? appendDatedNote(null, String(fields.notes)) : null })
        .select('id')
        .single()
      if (error) throw error
      return `Corso creato (${data.id})`
    }
    case 'aggiorna_corso': {
      const changes = pick((pl.changes ?? {}) as Record<string, unknown>, COURSE_FIELDS.filter((f) => f !== 'notes' && f !== 'status'))
      if (!Object.keys(changes).length) throw new Error('Nessun campo da aggiornare')
      const { error } = await supabase.from('courses').update(changes).eq('id', requireCourse(p))
      if (error) throw error
      return `Aggiornati: ${Object.keys(changes).join(', ')}`
    }
    case 'cambia_stato_corso':
    case 'aggiungi_nota_corso': {
      const id = requireCourse(p)
      const { data: c, error: e1 } = await supabase.from('courses').select('status, notes').eq('id', id).single()
      if (e1) throw e1
      const update: Record<string, unknown> =
        p.kind === 'cambia_stato_corso'
          ? { status: pl.stato, notes: appendDatedNote(c.notes, `Stato: ${c.status} → ${String(pl.stato)}. ${String(pl.motivo ?? '')}`) }
          : { notes: appendDatedNote(c.notes, String(pl.nota ?? '')) }
      const { error } = await supabase.from('courses').update(update).eq('id', id)
      if (error) throw error
      return p.kind === 'cambia_stato_corso' ? `Stato: ${c.status} → ${String(pl.stato)}` : 'Nota aggiunta'
    }
    case 'registra_pagamento': {
      const id = requireCourse(p)
      const { data: dup } = await supabase
        .from('course_payments')
        .select('id')
        .eq('course_id', id)
        .eq('direction', String(pl.direzione))
        .eq('amount', Number(pl.importo))
        .eq('paid_on', String(pl.data))
        .limit(1)
      if (dup?.length) throw new Error('Esiste già un movimento uguale')
      const { error } = await supabase.from('course_payments').insert({
        course_id: id,
        direction: pl.direzione,
        kind: pl.tipo,
        amount: pl.importo,
        paid_on: pl.data,
        reference: pl.riferimento ?? null,
        notes: pl.note ?? null,
        person_id: pl.persona_id ?? null,
        role: pl.ruolo ?? null,
      })
      if (error) throw error
      return 'Movimento registrato'
    }
    case 'allega_documento': {
      const id = requireCourse(p)
      const { data: a, error: e1 } = await supabase
        .from('pec_attachments')
        .select('id, file_name, mime_type, size_bytes, storage_path, document_id')
        .eq('id', String(pl.allegato_id))
        .single()
      if (e1) throw e1
      if (a.document_id) {
        const { error } = await supabase.from('document_courses').upsert({ document_id: a.document_id, course_id: id }, { ignoreDuplicates: true })
        if (error) throw error
        return 'Documento già presente: collegato al corso'
      }
      if (!a.storage_path) throw new Error('Allegato non disponibile')
      const path = buildDocumentStoragePath({ courseId: id, fileName: a.file_name })
      const copy = await supabase.storage.from('documents').copy(a.storage_path, path)
      if (copy.error) throw copy.error
      const { data: doc, error } = await supabase
        .from('documents')
        .insert({
          course_id: id,
          category: pl.categoria ?? 'other',
          title: pl.titolo ?? a.file_name,
          file_name: a.file_name,
          storage_path: path,
          mime_type: a.mime_type || 'application/octet-stream',
          size_bytes: a.size_bytes,
          uploaded_by: await currentUserId(),
        })
        .select('id')
        .single()
      if (error) {
        await supabase.storage.from('documents').remove([path])
        throw error
      }
      await supabase.from('pec_attachments').update({ document_id: doc.id }).eq('id', a.id)
      return 'Documento caricato nel corso'
    }
    case 'aggiungi_lezione': {
      const { error } = await supabase.from('calendar_events').insert({
        course_id: requireCourse(p),
        title: pl.titolo,
        starts_at: pl.inizio,
        ends_at: pl.fine,
        room: pl.aula ?? null,
        notes: pl.note ?? null,
      })
      if (error) throw error
      return 'Lezione aggiunta'
    }
  }
}

/** Accetta: applica la modifica e segna l'esito (errore compreso). */
export async function acceptProposal(p: ProposalRow): Promise<{ ok: boolean; message: string }> {
  try {
    const message = await apply(p)
    await finish(p.id, 'applicata', message)
    await supabase.from('mcp_audit_log').insert({
      tool: `proposta:${p.kind}`,
      course_id: p.course_id,
      summary: `Accettata: ${p.title}`.slice(0, 2000),
      args: { proposal_id: p.id, payload: p.payload },
      user_id: await currentUserId(),
    })
    return { ok: true, message }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Applicazione non riuscita'
    await finish(p.id, 'errore', message).catch(() => undefined)
    return { ok: false, message }
  }
}

export async function rejectProposal(id: string, reason: string): Promise<void> {
  await finish(id, 'rifiutata', reason.trim() || 'Rifiutata')
}
