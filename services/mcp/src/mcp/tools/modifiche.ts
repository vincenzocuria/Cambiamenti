import { z } from 'zod'
import { audit } from '../audit'
import { dbError } from '../db'
import { text, today, type McpCtx } from '../context'
import { COURSE_STATUSES } from './corsi'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data nel formato AAAA-MM-GG')
const dateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data e ora ISO, es. 2026-11-10T09:00:00+01:00')

const courseFields = {
  name: z.string().min(1).max(300).optional(),
  edition: z.string().max(100).optional(),
  code: z.string().max(50).optional().describe('ID corso della Regione, es. 673.7'),
  cup: z.string().max(30).optional(),
  start_date: date.optional(),
  end_date: date.optional(),
  duration_hours: z.number().min(0).max(5000).optional(),
  funding_program: z.string().max(300).optional().describe('Avviso/programma, es. GOL Avviso 2 - Catalogo'),
  funding_decree: z.string().max(300).optional().describe('Decreto di finanziamento, es. DD 11091 del 23/06/2026'),
}

/** Riga di nota datata, aggiunta in coda alle note del corso. */
export function appendNote(existing: string | null, note: string, day = today()): string {
  const line = `[${day}] ${note.trim()}`
  return existing?.trim() ? `${existing.trim()}\n${line}` : line
}

export function registerWriteTools({ server, db }: McpCtx): void {
  server.registerTool(
    'crea_corso',
    {
      description:
        'Crea un corso nuovo (es. trovato in una PEC). Prima controlla con cerca_corsi che non esista già: se esiste un corso con stesso nome ed edizione la creazione viene rifiutata.',
      inputSchema: z.object({
        ...courseFields,
        name: z.string().min(1).max(300),
        edition: z.string().max(100),
        status: z.enum(COURSE_STATUSES).optional(),
        notes: z.string().max(5000).optional().describe('Da dove vengono i dati (es. PEC del ... prot. ...)'),
      }),
    },
    async (args) => {
      const { data: dup, error: dupErr } = await db.from('courses').select('id').ilike('name', args.name).ilike('edition', args.edition).limit(1)
      if (dupErr) throw dbError(dupErr, 'Controllo duplicati')
      if (dup.length) throw new Error(`Esiste già un corso con questo nome ed edizione (id ${dup[0].id})`)
      const { data, error } = await db
        .from('courses')
        .insert({ ...args, status: args.status ?? 'bozza', notes: args.notes ? appendNote(null, args.notes) : null })
        .select('id, name, edition, status')
        .single()
      if (error) throw dbError(error, 'Creazione corso')
      const warning = await audit(db, { tool: 'crea_corso', courseId: data.id, summary: `Creato corso ${args.name} ${args.edition}`, args })
      return text({ creato: data, avviso: warning })
    },
  )

  server.registerTool(
    'aggiorna_corso',
    {
      description: 'Aggiorna i dati di un corso (solo i campi indicati). Per lo stato usa cambia_stato_corso, per le note aggiungi_nota_corso.',
      inputSchema: z.object({ id: z.string().uuid(), ...courseFields, motivo: z.string().max(500).optional().describe('Fonte della modifica, finisce nel registro') }),
      annotations: { idempotentHint: true },
    },
    async (args) => {
      const { id, motivo, ...fields } = args
      const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
      if (Object.keys(changes).length === 0) throw new Error('Nessun campo da aggiornare')
      const before = await db.from('courses').select(Object.keys(changes).join(', ')).eq('id', id).maybeSingle()
      if (before.error) throw dbError(before.error, 'Lettura corso')
      if (!before.data) throw new Error('Corso non trovato')
      const { data, error } = await db.from('courses').update(changes).eq('id', id).select('id, name, edition').single()
      if (error) throw dbError(error, 'Aggiornamento corso')
      const warning = await audit(db, {
        tool: 'aggiorna_corso',
        courseId: id,
        summary: `Aggiornati ${Object.keys(changes).join(', ')}${motivo ? ` — ${motivo}` : ''}`,
        args: { ...args, prima: before.data },
      })
      return text({ aggiornato: data, prima: before.data, dopo: changes, avviso: warning })
    },
  )

  server.registerTool(
    'cambia_stato_corso',
    {
      description:
        'Cambia lo stato del corso nel ciclo Regione: bozza → in_creazione → in_attivazione → in_corso → finito → rendicontato → esito_chiuso. Indica sempre il motivo (es. la PEC che lo giustifica).',
      inputSchema: z.object({ id: z.string().uuid(), stato: z.enum(COURSE_STATUSES), motivo: z.string().min(3).max(500) }),
      annotations: { idempotentHint: true },
    },
    async (args) => {
      const before = await db.from('courses').select('status, notes').eq('id', args.id).maybeSingle()
      if (before.error) throw dbError(before.error, 'Lettura corso')
      if (!before.data) throw new Error('Corso non trovato')
      const { data, error } = await db
        .from('courses')
        .update({ status: args.stato, notes: appendNote(before.data.notes as string | null, `Stato: ${before.data.status} → ${args.stato}. ${args.motivo}`) })
        .eq('id', args.id)
        .select('id, name, edition, status')
        .single()
      if (error) throw dbError(error, 'Cambio stato')
      const warning = await audit(db, { tool: 'cambia_stato_corso', courseId: args.id, summary: `${before.data.status} → ${args.stato}: ${args.motivo}`, args })
      return text({ aggiornato: data, stato_precedente: before.data.status, avviso: warning })
    },
  )

  server.registerTool(
    'aggiungi_nota_corso',
    {
      description: 'Aggiunge una nota datata in fondo alle note del corso (es. "PEC prot. 526230: richiesti adempimenti conclusivi entro il ...").',
      inputSchema: z.object({ id: z.string().uuid(), nota: z.string().min(3).max(2000) }),
    },
    async (args) => {
      const before = await db.from('courses').select('notes').eq('id', args.id).maybeSingle()
      if (before.error) throw dbError(before.error, 'Lettura corso')
      if (!before.data) throw new Error('Corso non trovato')
      const { error } = await db.from('courses').update({ notes: appendNote(before.data.notes as string | null, args.nota) }).eq('id', args.id)
      if (error) throw dbError(error, 'Aggiunta nota')
      const warning = await audit(db, { tool: 'aggiungi_nota_corso', courseId: args.id, summary: args.nota, args })
      return text({ ok: true, avviso: warning })
    },
  )

  server.registerTool(
    'registra_pagamento',
    {
      description:
        "Registra un movimento del corso: direzione in = incasso dalla Regione (anticipo/saldo/altro), out = compenso pagato al personale (serve persona_id e ruolo). Non registrare qui le note di debito già incassate su Aruba: sono già contate.",
      inputSchema: z.object({
        corso_id: z.string().uuid(),
        direzione: z.enum(['in', 'out']),
        tipo: z.enum(['anticipo', 'saldo', 'compenso', 'altro']),
        importo: z.number().positive(),
        data: date,
        riferimento: z.string().max(200).optional().describe('Es. mandato, bonifico, protocollo'),
        note: z.string().max(1000).optional(),
        persona_id: z.string().uuid().optional(),
        ruolo: z.enum(['teacher', 'tutor', 'admin_staff']).optional(),
      }),
    },
    async (args) => {
      if (args.direzione === 'out' && !args.persona_id) throw new Error('Per un compenso serve persona_id')
      const { data: dup } = await db
        .from('course_payments')
        .select('id')
        .eq('course_id', args.corso_id)
        .eq('direction', args.direzione)
        .eq('amount', args.importo)
        .eq('paid_on', args.data)
        .limit(1)
      if (dup?.length) throw new Error(`Esiste già un movimento uguale (id ${dup[0].id}): non lo registro due volte`)
      const { data, error } = await db
        .from('course_payments')
        .insert({
          course_id: args.corso_id,
          direction: args.direzione,
          kind: args.tipo,
          amount: args.importo,
          paid_on: args.data,
          reference: args.riferimento ?? null,
          notes: args.note ?? null,
          person_id: args.persona_id ?? null,
          role: args.ruolo ?? null,
        })
        .select('id, direction, kind, amount, paid_on')
        .single()
      if (error) throw dbError(error, 'Registrazione pagamento')
      const warning = await audit(db, {
        tool: 'registra_pagamento',
        courseId: args.corso_id,
        summary: `${args.direzione === 'in' ? 'Incasso' : 'Pagamento'} ${args.tipo} € ${args.importo} del ${args.data}`,
        args,
      })
      return text({ registrato: data, avviso: warning })
    },
  )

  server.registerTool(
    'aggiungi_lezione',
    {
      description: 'Aggiunge una lezione al calendario del corso.',
      inputSchema: z.object({
        corso_id: z.string().uuid(),
        titolo: z.string().min(1).max(200),
        inizio: dateTime,
        fine: dateTime,
        aula: z.string().max(100).optional(),
        note: z.string().max(1000).optional(),
      }),
    },
    async (args) => {
      if (Date.parse(args.fine) <= Date.parse(args.inizio)) throw new Error('La fine deve essere dopo l’inizio')
      const { data, error } = await db
        .from('calendar_events')
        .insert({ course_id: args.corso_id, title: args.titolo, starts_at: args.inizio, ends_at: args.fine, room: args.aula ?? null, notes: args.note ?? null })
        .select('id, title, starts_at, ends_at')
        .single()
      if (error) throw dbError(error, 'Aggiunta lezione')
      const warning = await audit(db, { tool: 'aggiungi_lezione', courseId: args.corso_id, summary: `Lezione «${args.titolo}» ${args.inizio}`, args })
      return text({ creata: data, avviso: warning })
    },
  )
}
