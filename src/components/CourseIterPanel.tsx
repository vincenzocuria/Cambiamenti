import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Course, DocumentRow } from '../types/db'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { fieldInputClass } from './Field'
import { fmtDate } from '../lib/format'
import { DOCUMENT_FILE_ACCEPT } from '../lib/documentFileTypes'
import {
  courseStepStatusLabels,
  evaluateIter,
  guessIterModel,
  iterModelLabels,
  iterPhaseLabels,
  summarizeIter,
  type CourseStep,
  type CourseStepStatus,
  type EvaluatedStep,
  type IterAction,
  type IterFacts,
  type IterModel,
  type IterPhase,
} from '../lib/courseIter'
import {
  addCourseStep,
  countFadDays,
  countLessons,
  createCourseIter,
  deleteCourseStep,
  linkStepDocument,
  listCourseSteps,
  generateStepDocument,
  listStepDocuments,
  resetCourseStepAuto,
  setCourseStepStatus,
  unlinkStepDocument,
  updateCourseStep,
} from '../services/courseSteps'
import { getPreviewUrl, uploadDocument } from '../services/documents'

const today = () => new Date().toISOString().slice(0, 10)

export type IterBaseFacts = Omit<IterFacts, 'lessons' | 'fadDays'>

const stateTone: Record<EvaluatedStep['state'], string> = {
  fatto: 'bg-emerald-500 text-white',
  in_corso: 'bg-amber-400 text-white',
  da_fare: 'border border-slate-300 bg-white text-slate-400',
  non_applicabile: 'bg-slate-200 text-slate-400',
}

/** Iter amministrativo del corso: passi, scadenze, documenti e prossimo passo. */
export function CourseIterPanel({
  course,
  facts,
  documents,
  onGoTo,
  onDocumentsChanged,
  onSummary,
}: {
  course: Course
  facts: IterBaseFacts
  documents: DocumentRow[]
  onGoTo: (action: IterAction) => void
  onDocumentsChanged: () => void
  onSummary?: (text: string, tone: 'ok' | 'warn' | 'default') => void
}) {
  const [steps, setSteps] = useState<CourseStep[] | null>(null)
  const [links, setLinks] = useState<Map<string, string[]>>(new Map())
  const [counts, setCounts] = useState({ lessons: 0, fadDays: 0 })
  const [model, setModel] = useState<IterModel>(() => guessIterModel(course))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newStep, setNewStep] = useState('')
  const [showDone, setShowDone] = useState(true)
  const autoCreated = useRef(false)

  const load = useCallback(async () => {
    try {
      let [s, lessons, fadDays] = await Promise.all([
        listCourseSteps(course.id),
        countLessons(course.id),
        countFadDays(course.id),
      ])
      if (!s.length && !autoCreated.current) {
        // Ogni corso ha sempre il suo iter: se manca lo imposto col modello proposto
        autoCreated.current = true
        await createCourseIter(course.id, guessIterModel(course), course.start_date, course.end_date, course.status)
        s = await listCourseSteps(course.id)
      }
      setSteps(s)
      setCounts({ lessons, fadDays })
      setLinks(await listStepDocuments(s.map((x) => x.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
      setSteps([])
    }
  }, [course.id])

  useEffect(() => {
    void load()
  }, [load])

  const now = today()
  const evaluated = useMemo(
    () => evaluateIter(steps ?? [], { ...facts, ...counts }, links, now),
    [steps, facts, counts, links, now],
  )
  const summary = useMemo(() => summarizeIter(evaluated), [evaluated])
  const docsById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents])

  useEffect(() => {
    if (!onSummary || !steps?.length) return
    const text = summary.next
      ? `${summary.done}/${summary.total} · prossimo: ${summary.next.step.title}`
      : `${summary.done}/${summary.total} · iter completo`
    onSummary(text, summary.overdue.length ? 'warn' : summary.next ? 'default' : 'ok')
  }, [summary, steps, onSummary])

  async function run(fn: () => Promise<void>) {
    setError('')
    setBusy(true)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  if (steps == null) return <p className="text-sm text-slate-400">Caricamento…</p>

  if (!steps.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm sm:p-5">
        <p className="text-slate-700">
          L'iter di questo corso non è ancora impostato. Scegli il modello: i passi già fatti (dati, organico, allievi,
          verbale, note di debito, incassi, documenti caricati) si riconoscono da soli.
        </p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={fieldInputClass + ' max-w-xs'}
            value={model}
            onChange={(e) => setModel(e.target.value as IterModel)}
            aria-label="Modello dell'iter"
          >
            {(Object.keys(iterModelLabels) as IterModel[]).map((m) => (
              <option key={m} value={m}>
                {iterModelLabels[m]}
              </option>
            ))}
          </select>
          <PrimaryButton
            type="button"
            disabled={busy}
            onClick={() => void run(() => createCourseIter(course.id, model, course.start_date, course.end_date, course.status))}
          >
            Imposta l'iter
          </PrimaryButton>
        </div>
      </div>
    )
  }

  const phases: { phase: IterPhase | 'altro'; items: EvaluatedStep[] }[] = []
  for (const e of evaluated) {
    const phase = e.def?.phase ?? 'altro'
    const last = phases[phases.length - 1]
    if (last && last.phase === phase) last.items.push(e)
    else phases.push({ phase, items: [e] })
  }
  const maxOrder = Math.max(0, ...steps.map((s) => s.sort_order))
  const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-400">Prossimo passo</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              {summary.next ? summary.next.step.title : 'Iter completo'}
              {summary.next?.step.due_on && (
                <span className={'ml-2 text-xs font-medium ' + (summary.next.overdue ? 'text-red-600' : 'text-slate-500')}>
                  entro il {fmtDate(summary.next.step.due_on)}
                </span>
              )}
            </p>
            {summary.next?.def?.description && <p className="mt-0.5 text-xs text-slate-500">{summary.next.def.description}</p>}
          </div>
          {summary.next?.def?.action && (
            <SecondaryButton size="sm" type="button" onClick={() => onGoTo(summary.next!.def!.action!)}>
              {summary.next.def.actionLabel ?? 'Vai'} →
            </SecondaryButton>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-500">
            {summary.done}/{summary.total} passi
            {summary.overdue.length > 0 && <span className="ml-2 font-medium text-red-600">{summary.overdue.length} in ritardo</span>}
          </span>
        </div>
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Mostra anche i passi fatti
        </label>
      </div>

      {phases.map(({ phase, items }, i) => {
        const shown = showDone ? items : items.filter((e) => e.state !== 'fatto' && e.state !== 'non_applicabile')
        if (!shown.length) return null
        return (
          <section key={`${phase}-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              {phase === 'altro' ? 'Altri passi' : iterPhaseLabels[phase]}
            </h3>
            <ol className="space-y-3">
              {shown.map((e) => (
                <StepRow
                  key={e.step.id}
                  item={e}
                  busy={busy}
                  now={now}
                  linkedIds={links.get(e.step.id) ?? []}
                  docsById={docsById}
                  documents={documents}
                  onRun={(fn) => void run(fn)}
                  onGoTo={onGoTo}
                  onGenerate={(template) =>
                    void run(async () => {
                      await generateStepDocument(e.step, template, course)
                      onDocumentsChanged()
                    })
                  }
                  onUpload={(file, title) =>
                    void run(async () => {
                      const doc = await uploadDocument({
                        courseId: course.id,
                        category: e.def?.category ?? 'other',
                        title: title || e.step.title,
                        file,
                      })
                      await linkStepDocument(e.step.id, doc.id)
                      onDocumentsChanged()
                    })
                  }
                />
              ))}
            </ol>
          </section>
        )
      })}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(ev) => {
          ev.preventDefault()
          const title = newStep.trim()
          if (!title) return
          void run(async () => {
            await addCourseStep(course.id, title, maxOrder + 10, null)
            setNewStep('')
          })
        }}
      >
        <input
          className={fieldInputClass + ' max-w-md flex-1'}
          placeholder="Aggiungi un passo (es. richiesta proroga, variazione allievi…)"
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          aria-label="Nuovo passo"
        />
        <SecondaryButton type="submit" disabled={busy || !newStep.trim()}>
          Aggiungi passo
        </SecondaryButton>
        <button
          type="button"
          className="ml-auto text-xs text-slate-400 underline hover:text-slate-600"
          disabled={busy}
          onClick={() => void run(() => createCourseIter(course.id, model, course.start_date, course.end_date, course.status))}
          title="Aggiunge i passi del modello che mancano, senza toccare gli altri"
        >
          Completa con il modello
        </button>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
          value={model}
          onChange={(e) => setModel(e.target.value as IterModel)}
          aria-label="Modello dell'iter"
        >
          {(Object.keys(iterModelLabels) as IterModel[]).map((m) => (
            <option key={m} value={m}>
              {iterModelLabels[m]}
            </option>
          ))}
        </select>
      </form>
    </div>
  )
}

function StepRow({
  item,
  busy,
  now,
  linkedIds,
  docsById,
  documents,
  onRun,
  onGoTo,
  onGenerate,
  onUpload,
}: {
  item: EvaluatedStep
  busy: boolean
  now: string
  linkedIds: string[]
  docsById: Map<string, DocumentRow>
  documents: DocumentRow[]
  onRun: (fn: () => Promise<void>) => void
  onGoTo: (action: IterAction) => void
  onGenerate: (template: string) => void
  onUpload: (file: File, title: string) => void
}) {
  const { step, def, state, autoDone, evidence, documentIds, overdue, blockedBy } = item
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: step.title, due_on: step.due_on ?? '', done_on: step.done_on ?? '', notes: step.notes })
  const [linking, setLinking] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const docs = documentIds.map((id) => docsById.get(id)).filter((d): d is DocumentRow => Boolean(d))
  const linkable = documents.filter((d) => !documentIds.includes(d.id))

  async function open(doc: DocumentRow) {
    window.open(await getPreviewUrl(doc), '_blank', 'noopener')
  }

  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' + stateTone[state]}
      >
        {state === 'fatto' ? '✓' : state === 'non_applicabile' ? '–' : ''}
      </span>
      <div className={'min-w-0 flex-1 ' + (state === 'non_applicabile' ? 'opacity-60' : '')}>
        {editing ? (
          <div className="space-y-2">
            <input
              className={fieldInputClass}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              aria-label="Titolo del passo"
            />
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-2">
                Scadenza
                <input type="date" className={fieldInputClass + ' w-auto'} value={draft.due_on} onChange={(e) => setDraft({ ...draft, due_on: e.target.value })} />
              </label>
              <label className="flex items-center gap-2">
                Fatto il
                <input type="date" className={fieldInputClass + ' w-auto'} value={draft.done_on} onChange={(e) => setDraft({ ...draft, done_on: e.target.value })} />
              </label>
            </div>
            <textarea
              className={fieldInputClass}
              rows={2}
              placeholder="Note (protocollo PEC, chi l'ha fatto, cosa manca…)"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton
                type="button"
                disabled={busy || !draft.title.trim()}
                onClick={() =>
                  onRun(async () => {
                    await updateCourseStep(step.id, {
                      title: draft.title.trim(),
                      due_on: draft.due_on || null,
                      done_on: draft.done_on || null,
                      notes: draft.notes,
                      ...(draft.done_on && step.status !== 'fatto' ? { status: 'fatto' as const } : {}),
                    })
                    setEditing(false)
                  })
                }
              >
                Salva
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setEditing(false)}>
                Annulla
              </SecondaryButton>
              <button
                type="button"
                className="ml-auto text-xs text-slate-400 underline hover:text-red-600"
                onClick={() => {
                  if (window.confirm(`Togliere il passo «${step.title}»?`)) onRun(() => deleteCourseStep(step.id))
                }}
              >
                Elimina passo
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={'text-sm font-medium ' + (state === 'fatto' ? 'text-slate-500' : 'text-slate-800')}>{step.title}</span>
              {overdue && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">In ritardo</span>}
              {state === 'in_corso' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">In corso</span>}
              {autoDone && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Risulta fatto</span>}
              {step.manual && (
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200"
                  title="Lo stato è stato scelto a mano. Clic: torna a deciderlo il gestionale dai dati e dai documenti"
                  disabled={busy}
                  onClick={() => onRun(() => resetCourseStepAuto(step))}
                >
                  Segnato a mano · rendi automatico
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {[
                evidence,
                step.done_on && `fatto il ${fmtDate(step.done_on)}`,
                step.due_on && state !== 'fatto' && state !== 'non_applicabile' && `entro il ${fmtDate(step.due_on)}`,
              ]
                .filter(Boolean)
                .join(' · ') || def?.description}
            </p>
            {blockedBy.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-400">Dopo: {blockedBy.join(', ')}</p>
            )}
            {def?.needs && state !== 'fatto' && state !== 'non_applicabile' && (
              <p className="mt-0.5 text-xs text-amber-700">Serve: {def.needs}</p>
            )}
            {step.notes && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{step.notes}</p>}
            {docs.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {docs.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs">
                    <button type="button" className="text-indigo-700 hover:underline" onClick={() => void open(d)}>
                      📎 {d.title || d.file_name}
                    </button>
                    {linkedIds.includes(d.id) && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-600"
                        title="Scollega dal passo (il documento resta nel corso)"
                        aria-label={`Scollega ${d.title || d.file_name}`}
                        onClick={() => onRun(() => unlinkStepDocument(step.id, d.id))}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                value={state}
                disabled={busy}
                onChange={(e) => onRun(() => setCourseStepStatus(step, e.target.value as CourseStepStatus, now))}
                aria-label={`Stato di ${step.title}`}
              >
                {(Object.keys(courseStepStatusLabels) as CourseStepStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {courseStepStatusLabels[s]}

                  </option>
                ))}
              </select>
              <button type="button" className="text-xs text-slate-500 underline hover:text-slate-700" onClick={() => fileInput.current?.click()} disabled={busy}>
                Carica documento
              </button>
              <input
                ref={fileInput}
                type="file"
                accept={DOCUMENT_FILE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) onUpload(f, '')
                }}
              />
              {def?.template && (
                <button
                  type="button"
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                  disabled={busy}
                  title={`Genera «${def.template}» con i dati del corso (da completare, firmare e inviare)`}
                  onClick={() => onGenerate(def.template!)}
                >
                  Genera lettera
                </button>
              )}
              {linkable.length > 0 && (
                <button type="button" className="text-xs text-slate-500 underline hover:text-slate-700" onClick={() => setLinking((v) => !v)}>
                  Collega documento del corso
                </button>
              )}
              {def?.action && (
                <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => onGoTo(def.action!)}>
                  {def.actionLabel ?? 'Vai'} →
                </button>
              )}
              <button
                type="button"
                className="text-xs text-slate-500 underline hover:text-slate-700"
                onClick={() => {
                  setDraft({ title: step.title, due_on: step.due_on ?? '', done_on: step.done_on ?? '', notes: step.notes })
                  setEditing(true)
                }}
              >
                Scadenza e note
              </button>
            </div>
            {linking && (
              <select
                className={fieldInputClass + ' mt-2'}
                defaultValue=""
                aria-label="Documento da collegare"
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) return
                  setLinking(false)
                  onRun(() => linkStepDocument(step.id, id))
                }}
              >
                <option value="">Scegli un documento del corso…</option>
                {linkable.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || d.file_name}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </div>
    </li>
  )
}
