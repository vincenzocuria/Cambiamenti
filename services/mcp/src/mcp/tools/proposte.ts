import { z } from 'zod'
import { dbError } from '../db'
import { text, type McpCtx } from '../context'
import { COURSE_STATUSES } from './corsi'
import { DOCUMENT_CATEGORIES } from './documenti'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data nel formato AAAA-MM-GG')
const COURSE_FIELDS = ['name', 'edition', 'code', 'cup', 'start_date', 'end_date', 'duration_hours', 'funding_program', 'funding_decree'] as const

const courseData = z.object({
  name: z.string().min(1).max(300).optional(),
  edition: z.string().max(100).optional(),
  code: z.string().max(50).optional(),
  cup: z.string().max(30).optional(),
  start_date: date.optional(),
  end_date: date.optional(),
  duration_hours: z.number().min(0).max(5000).optional(),
  funding_program: z.string().max(300).optional(),
  funding_decree: z.string().max(300).optional(),
})

const change = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('crea_corso'), dati: courseData.extend({ name: z.string().min(1).max(300), edition: z.string().max(100), status: z.enum(COURSE_STATUSES).optional(), notes: z.string().max(5000).optional() }) }),
  z.object({ tipo: z.literal('aggiorna_corso'), corso_id: z.string().uuid(), dati: courseData }),
  z.object({ tipo: z.literal('cambia_stato_corso'), corso_id: z.string().uuid(), stato: z.enum(COURSE_STATUSES), motivo: z.string().min(3).max(500) }),
  z.object({ tipo: z.literal('aggiungi_nota_corso'), corso_id: z.string().uuid(), nota: z.string().min(3).max(2000) }),
  z.object({
    tipo: z.literal('registra_pagamento'),
    corso_id: z.string().uuid(),
    direzione: z.enum(['in', 'out']),
    tipo_movimento: z.enum(['anticipo', 'saldo', 'compenso', 'altro']),
    importo: z.number().positive(),
    data: date,
    riferimento: z.string().max(200).optional(),
    note: z.string().max(1000).optional(),
  }),
  z.object({
    tipo: z.literal('allega_documento'),
    corso_id: z.string().uuid(),
    allegato_id: z.string().uuid().describe('Allegato PEC (da leggi_pec)'),
    categoria: z.enum(DOCUMENT_CATEGORIES),
    titolo: z.string().min(1).max(200),
  }),
  z.object({
    tipo: z.literal('aggiungi_lezione'),
    corso_id: z.string().uuid(),
    titolo: z.string().min(1).max(200),
    inizio: z.string(),
    fine: z.string(),
    aula: z.string().max(100).optional(),
  }),
])

type Change = z.infer<typeof change>

/** Forma salvata in proposals.payload (letta da src/services/proposals.ts). */
export function toPayload(c: Change): { kind: string; courseId: string | null; payload: Record<string, unknown> } {
  switch (c.tipo) {
    case 'crea_corso':
      return { kind: c.tipo, courseId: null, payload: { ...c.dati } }
    case 'aggiorna_corso':
      return { kind: c.tipo, courseId: c.corso_id, payload: { changes: { ...c.dati } } }
    case 'cambia_stato_corso':
      return { kind: c.tipo, courseId: c.corso_id, payload: { stato: c.stato, motivo: c.motivo } }
    case 'aggiungi_nota_corso':
      return { kind: c.tipo, courseId: c.corso_id, payload: { nota: c.nota } }
    case 'registra_pagamento':
      return {
        kind: c.tipo,
        courseId: c.corso_id,
        payload: { direzione: c.direzione, tipo: c.tipo_movimento, importo: c.importo, data: c.data, riferimento: c.riferimento, note: c.note },
      }
    case 'allega_documento':
      return { kind: c.tipo, courseId: c.corso_id, payload: { allegato_id: c.allegato_id, categoria: c.categoria, titolo: c.titolo } }
    case 'aggiungi_lezione':
      return { kind: c.tipo, courseId: c.corso_id, payload: { titolo: c.titolo, inizio: c.inizio, fine: c.fine, aula: c.aula } }
  }
}

export function registerProposalTools({ server, db }: McpCtx): void {
  server.registerTool(
    'proponi_modifica',
    {
      description:
        "Propone una modifica al gestionale senza farla: finisce nella pagina «Proposte», dove una persona la accetta o la rifiuta. È il modo standard per gli aggiornamenti che vengono dalle PEC. Il titolo deve dire in breve corso e modifica; il motivo deve citare la fonte (protocollo, data, riga del documento).",
      inputSchema: z.object({
        titolo: z.string().min(3).max(300).describe('Es. «Eipass Progressive ED3 - 2026: inserire CUP J34D26003310006»'),
        motivo: z.string().min(3).max(4000).describe('Cosa dice la fonte, con protocollo e data'),
        pec_id: z.string().uuid().optional().describe('PEC da cui viene la proposta'),
        modifica: change,
      }),
    },
    async ({ titolo, motivo, pec_id, modifica }) => {
      const { kind, courseId, payload } = toPayload(modifica)
      let current: Record<string, unknown> = {}
      if (courseId) {
        const cols = kind === 'aggiorna_corso' ? Object.keys((payload.changes ?? {}) as object).filter((k) => (COURSE_FIELDS as readonly string[]).includes(k)) : ['status']
        const { data, error } = await db.from('courses').select(['id', ...cols].join(', ')).eq('id', courseId).maybeSingle()
        if (error) throw dbError(error, 'Lettura corso')
        if (!data) throw new Error('Corso non trovato')
        const { id: _id, ...rest } = data as unknown as Record<string, unknown>
        current = rest
        if (kind === 'aggiorna_corso') {
          const changes = payload.changes as Record<string, unknown>
          const same = Object.keys(changes).filter((k) => String(changes[k] ?? '') === String(current[k] ?? ''))
          for (const k of same) delete changes[k]
          if (!Object.keys(changes).length) return text({ saltata: 'I valori proposti sono già quelli nel gestionale' })
        }
      }
      if (kind === 'allega_documento') {
        const { data: a, error } = await db.from('pec_attachments').select('file_name').eq('id', String(payload.allegato_id)).maybeSingle()
        if (error) throw dbError(error, 'Lettura allegato')
        if (!a) throw new Error('Allegato PEC non trovato')
        payload.file_name = a.file_name
      }
      const { data: pending } = await db.from('proposals').select('id, course_id, payload').eq('status', 'proposta').eq('kind', kind).limit(500)
      const dup = (pending ?? []).find((p) => p.course_id === courseId && JSON.stringify(p.payload) === JSON.stringify(payload))
      if (dup) return text({ saltata: `Proposta uguale già in attesa (${dup.id})` })
      const { data, error } = await db
        .from('proposals')
        .insert({ kind, course_id: courseId, pec_message_id: pec_id ?? null, title: titolo, reason: motivo, payload, current_values: current })
        .select('id, kind, title')
        .single()
      if (error) throw dbError(error, 'Salvataggio proposta')
      return text({ proposta: data })
    },
  )

  server.registerTool(
    'elenco_proposte',
    {
      description: 'Proposte già fatte (predefinito: in attesa di decisione), per non ripeterle e per vedere cosa è stato accettato o rifiutato e perché.',
      inputSchema: z.object({
        stato: z.enum(['proposta', 'applicata', 'rifiutata', 'errore']).optional(),
        corso_id: z.string().uuid().optional(),
        limite: z.number().int().min(1).max(200).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ stato = 'proposta', corso_id, limite }) => {
      let q = db.from('proposals').select('id, kind, title, reason, status, result, course_id, pec_message_id, created_at, decided_at').eq('status', stato).order('created_at', { ascending: false }).limit(limite ?? 50)
      if (corso_id) q = q.eq('course_id', corso_id)
      const { data, error } = await q
      if (error) throw dbError(error, 'Lettura proposte')
      return text(data)
    },
  )
}
