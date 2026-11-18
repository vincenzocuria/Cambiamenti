import { z } from 'zod'
import { ITER_STEPS, defaultDue, guessIterModel, iterRows, stepDef } from '../../../../../src/lib/courseIter'
import { dueSteps, loadIterOverview } from '../../../../../src/lib/courseIterLoad'
import { golTemplateSeeds } from '../../../../../src/data/golTemplates'
import { fillTemplate } from '../../../../../src/lib/fillTemplate'
import { buildTemplateContext } from '../../../../../src/lib/templateContext'
import { slugFileName, toHtmlDocument } from '../../../../../src/lib/templateHtml'
import { buildDocumentStoragePath } from '../../../../../src/lib/documentStoragePath'
import type { Course } from '../../../../../src/types/db'
import { audit } from '../audit'
import { dbError } from '../db'
import { text, today, type McpCtx } from '../context'

const STEP_KEYS = ITER_STEPS.map((d) => d.key) as [string, ...string[]]
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data nel formato AAAA-MM-GG')

export function registerIterTools({ server, db, auth }: McpCtx): void {
  /** Passo del corso con questa chiave; se manca lo crea dal modello. */
  async function ensureStep(courseId: string, key: string): Promise<{ id: string; status: string; done_on: string | null; notes: string; title: string }> {
    const def = stepDef(key)
    if (!def) throw new Error(`Passo «${key}» sconosciuto`)
    const found = await db.from('course_steps').select('id, status, done_on, notes, title').eq('course_id', courseId).eq('step_key', key).maybeSingle()
    if (found.error) throw dbError(found.error, 'Lettura passo')
    if (found.data) return found.data
    const { data: c, error } = await db.from('courses').select('start_date, end_date').eq('id', courseId).maybeSingle()
    if (error) throw dbError(error, 'Lettura corso')
    if (!c) throw new Error('Corso non trovato')
    const order = ITER_STEPS.findIndex((d) => d.key === key)
    const created = await db
      .from('course_steps')
      .insert({ course_id: courseId, step_key: key, title: def.title, sort_order: (order + 1) * 10, due_on: defaultDue(def, c.start_date, c.end_date) })
      .select('id, status, done_on, notes, title')
      .single()
    if (created.error) throw dbError(created.error, 'Creazione passo')
    return created.data
  }

  async function linkDocs(stepId: string, courseId: string, documentIds: string[]) {
    for (const documentId of documentIds) {
      const c = await db.from('document_courses').upsert({ document_id: documentId, course_id: courseId }, { ignoreDuplicates: true })
      if (c.error) throw dbError(c.error, 'Collegamento documento al corso')
      const s = await db.from('course_step_documents').upsert({ step_id: stepId, document_id: documentId }, { ignoreDuplicates: true })
      if (s.error) throw dbError(s.error, 'Collegamento documento al passo')
    }
  }

  server.registerTool(
    'imposta_iter',
    {
      description:
        "Crea i passi dell'iter amministrativo di un corso (dal decreto alla chiusura) dal modello GOL o «standard» (altri avvisi). Non tocca i passi già presenti. Da usare subito dopo aver creato un corso dalle scansioni.",
      inputSchema: z.object({
        corso_id: z.string().uuid(),
        modello: z.enum(['gol', 'standard']).optional().describe('Predefinito: GOL se il programma o il nome del corso lo dicono'),
      }),
    },
    async ({ corso_id, modello }) => {
      const { data: c, error } = await db.from('courses').select('id, name, funding_program, start_date, end_date').eq('id', corso_id).maybeSingle()
      if (error) throw dbError(error, 'Lettura corso')
      if (!c) throw new Error('Corso non trovato')
      const model = modello ?? guessIterModel(c)
      const existing = await db.from('course_steps').select('step_key').eq('course_id', corso_id)
      if (existing.error) throw dbError(existing.error, 'Lettura passi')
      const have = new Set((existing.data ?? []).map((r) => r.step_key))
      const rows = iterRows(model, corso_id, c.start_date, c.end_date).filter((r) => !have.has(r.step_key))
      if (rows.length) {
        const ins = await db.from('course_steps').insert(rows)
        if (ins.error) throw dbError(ins.error, 'Creazione iter')
      }
      const warning = await audit(db, { tool: 'imposta_iter', courseId: corso_id, summary: `Iter ${model}: ${rows.length} passi creati`, args: { corso_id, modello: model } })
      return text({ modello: model, passi_creati: rows.length, passi_gia_presenti: have.size, avviso: warning })
    },
  )

  server.registerTool(
    'aggiorna_passo',
    {
      description:
        "Aggiorna un passo dell'iter di un corso: stato, data in cui è fatto, scadenza, nota (aggiunta in coda con la data) e documenti da collegare al passo (id da carica_documento/registra_documento). Se il passo non c'è lo crea. Scrittura diretta: usala quando la persona ti ha chiesto di seguire l'iter o di sistemare il corso; per gli aggiornamenti dalle PEC usa proponi_modifica (aggiorna_passo).",
      inputSchema: z.object({
        corso_id: z.string().uuid(),
        passo: z.enum(STEP_KEYS),
        stato: z.enum(['da_fare', 'in_corso', 'fatto', 'non_applicabile']).optional(),
        fatto_il: date.optional(),
        scadenza: date.optional(),
        nota: z.string().max(2000).optional(),
        documento_ids: z.array(z.string().uuid()).max(20).optional(),
      }),
    },
    async (args) => {
      const step = await ensureStep(args.corso_id, args.passo)
      const patch: Record<string, unknown> = {}
      if (args.stato) {
        patch.status = args.stato
        patch.manual = true
        patch.done_on = args.stato === 'fatto' ? (args.fatto_il ?? step.done_on ?? today()) : null
      } else if (args.fatto_il) patch.done_on = args.fatto_il
      if (args.scadenza) patch.due_on = args.scadenza
      if (args.nota) patch.notes = `${step.notes ? `${step.notes.trim()}\n` : ''}[${today()}] ${args.nota.trim()}`
      if (Object.keys(patch).length) {
        const up = await db.from('course_steps').update(patch).eq('id', step.id)
        if (up.error) throw dbError(up.error, 'Aggiornamento passo')
      }
      if (args.documento_ids?.length) await linkDocs(step.id, args.corso_id, args.documento_ids)
      const warning = await audit(db, {
        tool: 'aggiorna_passo',
        courseId: args.corso_id,
        summary: `Passo «${step.title}»: ${[args.stato, args.nota].filter(Boolean).join(' — ') || 'documenti collegati'}`.slice(0, 500),
        args,
      })
      return text({ passo: step.title, aggiornato: patch, documenti_collegati: args.documento_ids?.length ?? 0, avviso: warning })
    },
  )

  server.registerTool(
    'genera_lettera_passo',
    {
      description:
        "Genera dal modello la lettera di un passo dell'iter (comunicazione_avvio, adempimenti_conclusivi, controfirma_verbale) con i dati del corso, la salva nei documenti del corso e la collega al passo. È una bozza: va completata, firmata digitalmente e inviata.",
      inputSchema: z.object({ corso_id: z.string().uuid(), passo: z.enum(STEP_KEYS) }),
    },
    async ({ corso_id, passo }) => {
      const def = stepDef(passo)
      if (!def?.template) throw new Error(`Il passo «${passo}» non ha una lettera da generare`)
      const { data: course, error } = await db.from('courses').select('*').eq('id', corso_id).maybeSingle()
      if (error) throw dbError(error, 'Lettura corso')
      if (!course) throw new Error('Corso non trovato')
      let tpl = await db.from('document_templates').select('id, name, body, default_category').eq('name', def.template).maybeSingle()
      if (tpl.error) throw dbError(tpl.error, 'Lettura modello')
      if (!tpl.data) {
        const seed = golTemplateSeeds.find((t) => t.name === def.template)
        if (!seed) throw new Error(`Modello «${def.template}» non trovato`)
        tpl = await db.from('document_templates').insert(seed).select('id, name, body, default_category').single()
        if (tpl.error) throw dbError(tpl.error, 'Creazione modello')
      }
      const template = tpl.data!
      const title = `${template.name} — ${course.name}`
      const html = toHtmlDocument(title, fillTemplate(template.body, buildTemplateContext({ course: course as Course })))
      const fileName = `${slugFileName(title) || 'documento'}.html`
      const bytes = new TextEncoder().encode(html)
      const path = buildDocumentStoragePath({ courseId: corso_id, fileName })
      const up = await db.storage.from('documents').upload(path, bytes, { contentType: 'text/html' })
      if (up.error) throw dbError(up.error, 'Caricamento lettera')
      const doc = await db
        .from('documents')
        .insert({
          course_id: corso_id,
          category: template.default_category,
          title,
          template_id: template.id,
          file_name: fileName,
          storage_path: path,
          mime_type: 'text/html',
          size_bytes: bytes.length,
          uploaded_by: auth.userId,
        })
        .select('id, title')
        .single()
      if (doc.error) {
        await db.storage.from('documents').remove([path])
        throw dbError(doc.error, 'Registrazione lettera')
      }
      const step = await ensureStep(corso_id, passo)
      await linkDocs(step.id, corso_id, [doc.data.id])
      const warning = await audit(db, { tool: 'genera_lettera_passo', courseId: corso_id, summary: `Generata «${title}»`, args: { corso_id, passo } })
      return text({ generato: doc.data, da_fare: def.needs ?? 'Completare, firmare e inviare', avviso: warning })
    },
  )

  server.registerTool(
    'iter_corsi',
    {
      description:
        "Quadro dell'iter di tutti i corsi (o di quelli indicati): per ogni corso passi fatti, prossimo passo, passi in ritardo o in scadenza, e cosa serve dalla persona (firme, dati). Usalo per sapere cosa fare oggi e cosa chiedere.",
      inputSchema: z.object({
        corso_ids: z.array(z.string().uuid()).max(50).optional(),
        giorni: z.number().int().min(1).max(120).optional().describe('Finestra delle scadenze, predefinito 14'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ corso_ids, giorni = 14 }) => {
      const now = today()
      const overview = await loadIterOverview(db, now, corso_ids)
      return text({
        corsi: overview.map((o) => ({
          corso: o.course,
          passi_fatti: `${o.summary.done}/${o.summary.total}`,
          prossimo_passo: o.summary.next?.step.title ?? 'iter completo',
          in_ritardo: o.summary.overdue.map((e) => ({ passo: e.step.title, scadenza: e.step.due_on })),
          serve_dalla_persona: o.evaluated
            .filter((e) => (e.state === 'da_fare' || e.state === 'in_corso') && e.def?.needs && !e.blockedBy.length)
            .map((e) => ({ passo: e.step.title, serve: e.def!.needs })),
        })),
        scadenze: dueSteps(overview, now, giorni),
        corsi_senza_iter: 'Usa cerca_corsi e imposta_iter per i corsi che non compaiono qui',
      })
    },
  )
}
