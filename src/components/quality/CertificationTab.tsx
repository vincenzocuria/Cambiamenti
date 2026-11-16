import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PrimaryButton, SecondaryButton } from '../Buttons'
import { fieldInputClass } from '../Field'
import { KpiCards } from '../KpiCards'
import { fmtDate } from '../../lib/format'
import { DOCUMENT_FILE_ACCEPT } from '../../lib/documentFileTypes'
import {
  certificationStatusLabels,
  daysToExpiry,
  fileCategoryLabels,
  iterProgress,
  sortSteps,
  stepStatusLabels,
  surveillanceDates,
  type Certification,
  type CertificationFile,
  type CertificationFileCategory,
  type CertificationInput,
  type CertificationStatus,
  type CertificationStep,
  type StepStatus,
} from '../../lib/certification'
import {
  addStep,
  certificationFileUrl,
  deleteCertificationFile,
  deleteStep,
  listCertificationFiles,
  listCertifications,
  listSteps,
  setStepStatus,
  updateCertification,
  updateStep,
  uploadCertificationFile,
} from '../../services/certification'

const today = () => new Date().toISOString().slice(0, 10)
const label = 'mb-1 block text-xs font-medium text-slate-600'

const statusTone: Record<CertificationStatus, string> = {
  in_corso: 'bg-indigo-50 text-indigo-700',
  certificato: 'bg-emerald-50 text-emerald-700',
  sospeso: 'bg-amber-50 text-amber-800',
  scaduto: 'bg-red-50 text-red-700',
  ritirato: 'bg-slate-100 text-slate-500',
}

const stepTone: Record<StepStatus, string> = {
  da_fare: 'border-slate-300 bg-white',
  in_corso: 'border-indigo-400 bg-indigo-50',
  fatto: 'border-emerald-500 bg-emerald-500',
  non_applicabile: 'border-slate-200 bg-slate-100',
}

function toInput(c: Certification): CertificationInput {
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = c
  void _id
  void _c
  void _u
  return rest
}

function CertificationForm({ value, onChange }: { value: CertificationInput; onChange: (v: CertificationInput) => void }) {
  const set = <K extends keyof CertificationInput>(k: K, v: CertificationInput[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block sm:col-span-2">
        <span className={label}>Norma</span>
        <input className={fieldInputClass} value={value.standard} onChange={(e) => set('standard', e.target.value)} />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Settore</span>
        <input className={fieldInputClass} value={value.sector} onChange={(e) => set('sector', e.target.value)} />
      </label>
      <label className="block sm:col-span-2 lg:col-span-4">
        <span className={label}>Campo di applicazione</span>
        <textarea className={fieldInputClass} rows={2} value={value.scope} onChange={(e) => set('scope', e.target.value)} />
      </label>
      <label className="block">
        <span className={label}>Ente di certificazione</span>
        <input className={fieldInputClass} value={value.body} onChange={(e) => set('body', e.target.value)} placeholder="da indicare" />
      </label>
      <label className="block">
        <span className={label}>Auditor</span>
        <input className={fieldInputClass} value={value.auditor} onChange={(e) => set('auditor', e.target.value)} />
      </label>
      <label className="block">
        <span className={label}>Consulente / referente</span>
        <input className={fieldInputClass} value={value.consultant} onChange={(e) => set('consultant', e.target.value)} />
      </label>
      <label className="block">
        <span className={label}>Stato</span>
        <select className={fieldInputClass} value={value.status} onChange={(e) => set('status', e.target.value as CertificationStatus)}>
          {(Object.keys(certificationStatusLabels) as CertificationStatus[]).map((s) => (
            <option key={s} value={s}>
              {certificationStatusLabels[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>N. certificato</span>
        <input className={fieldInputClass} value={value.certificate_number} onChange={(e) => set('certificate_number', e.target.value)} />
      </label>
      <label className="block">
        <span className={label}>Emesso il</span>
        <input type="date" className={fieldInputClass} value={value.issued_on ?? ''} onChange={(e) => set('issued_on', e.target.value || null)} />
      </label>
      <label className="block">
        <span className={label}>Scade il</span>
        <input type="date" className={fieldInputClass} value={value.expires_on ?? ''} onChange={(e) => set('expires_on', e.target.value || null)} />
      </label>
      <label className="block sm:col-span-2 lg:col-span-4">
        <span className={label}>Note</span>
        <textarea className={fieldInputClass} rows={2} value={value.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </div>
  )
}

function StepRow({
  step,
  files,
  busy,
  onRun,
  onOpenFile,
}: {
  step: CertificationStep
  files: CertificationFile[]
  busy: boolean
  onRun: (fn: () => Promise<void>) => void
  onOpenFile: (f: CertificationFile) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: step.title, due_on: step.due_on ?? '', done_on: step.done_on ?? '', notes: step.notes })
  const now = today()
  const overdue = step.status !== 'fatto' && step.status !== 'non_applicabile' && !!step.due_on && step.due_on < now

  return (
    <li className="relative pl-8">
      <span className={`absolute top-1.5 left-0 flex h-4 w-4 items-center justify-center rounded-full border-2 ${stepTone[step.status]}`}>
        {step.status === 'fatto' && (
          <svg viewBox="0 0 16 16" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m3 8 3 3 7-7" />
          </svg>
        )}
      </span>
      {editing ? (
        <div className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3">
          <input className={fieldInputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Entro il</span>
              <input type="date" className={fieldInputClass} value={draft.due_on} onChange={(e) => setDraft({ ...draft, due_on: e.target.value })} />
            </label>
            <label className="block">
              <span className={label}>Fatto il</span>
              <input type="date" className={fieldInputClass} value={draft.done_on} onChange={(e) => setDraft({ ...draft, done_on: e.target.value })} />
            </label>
          </div>
          <textarea className={fieldInputClass} rows={2} placeholder="Note" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              type="button"
              disabled={busy || !draft.title.trim()}
              onClick={() =>
                onRun(async () => {
                  await updateStep(step.id, {
                    title: draft.title.trim(),
                    due_on: draft.due_on || null,
                    done_on: draft.done_on || null,
                    notes: draft.notes.trim(),
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
                if (window.confirm(`Togliere la fase «${step.title}»?`)) onRun(() => deleteStep(step.id))
              }}
            >
              Elimina fase
            </button>
          </div>
        </div>
      ) : (
        <div className={`pb-1 ${step.status === 'non_applicabile' ? 'opacity-50' : ''}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`text-sm font-medium ${step.status === 'fatto' ? 'text-slate-500' : 'text-slate-900'}`}>{step.title}</span>
            {overdue && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">In ritardo</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              value={step.status}
              disabled={busy}
              onChange={(e) => onRun(() => setStepStatus(step, e.target.value as StepStatus, now))}
              aria-label={`Stato di ${step.title}`}
            >
              {(Object.keys(stepStatusLabels) as StepStatus[]).map((s) => (
                <option key={s} value={s}>
                  {stepStatusLabels[s]}
                </option>
              ))}
            </select>
            <button type="button" className="text-xs text-slate-500 underline hover:text-slate-700" onClick={() => setEditing(true)}>
              Modifica
            </button>
            <span className="text-xs text-slate-500">
              {[step.done_on && `fatto il ${fmtDate(step.done_on)}`, step.due_on && step.status !== 'fatto' && `entro il ${fmtDate(step.due_on)}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          {step.notes && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{step.notes}</p>}
          {files.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onOpenFile(f)}
                  className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-50"
                >
                  📎 {f.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/** Iter di certificazione: dati, fasi con date e documenti, certificato. */
export function CertificationTab() {
  const [cert, setCert] = useState<Certification | null>(null)
  const [steps, setSteps] = useState<CertificationStep[]>([])
  const [files, setFiles] = useState<CertificationFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CertificationInput | null>(null)
  const [newStep, setNewStep] = useState('')
  const [upload, setUpload] = useState({ category: 'richiesta' as CertificationFileCategory, title: '', docDate: today(), stepId: '', notes: '' })
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await listCertifications()
      const c = list[0] ?? null
      setCert(c)
      if (c) {
        const [s, f] = await Promise.all([listSteps(c.id), listCertificationFiles(c.id)])
        setSteps(sortSteps(s))
        setFiles(f)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const now = today()
  const progress = useMemo(() => iterProgress(steps, now), [steps, now])
  const filesByStep = useMemo(() => {
    const m = new Map<string, CertificationFile[]>()
    for (const f of files) if (f.step_id) m.set(f.step_id, [...(m.get(f.step_id) ?? []), f])
    return m
  }, [files])
  const filesByCategory = useMemo(() => {
    const m = new Map<CertificationFileCategory, CertificationFile[]>()
    for (const f of files) m.set(f.category, [...(m.get(f.category) ?? []), f])
    return (Object.keys(fileCategoryLabels) as CertificationFileCategory[]).filter((k) => m.has(k)).map((k) => [k, m.get(k)!] as const)
  }, [files])

  async function run(fn: () => Promise<void>) {
    setError('')
    setInfo('')
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

  async function openFile(f: CertificationFile) {
    try {
      window.open(await certificationFileUrl(f), '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apertura non riuscita')
    }
  }

  function submitUpload(ev: FormEvent) {
    ev.preventDefault()
    if (!cert || !file) return setError('Scegli il file da caricare')
    const isCertificate = upload.category === 'certificato'
    void run(async () => {
      await uploadCertificationFile({
        certificationId: cert.id,
        stepId: upload.stepId || null,
        category: upload.category,
        title: upload.title,
        docDate: upload.docDate || null,
        notes: upload.notes,
        file,
      })
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      setUpload((u) => ({ ...u, title: '', notes: '' }))
      if (isCertificate && cert.status !== 'certificato') {
        setDraft({ ...toInput(cert), status: 'certificato', issued_on: cert.issued_on ?? upload.docDate ?? null })
        setEditing(true)
        setInfo('Certificato caricato: completa numero, data di emissione e scadenza e salva.')
      } else {
        setInfo('Documento caricato')
      }
    })
  }

  if (loading) return <p className="text-sm text-slate-500">Carico…</p>
  if (!cert) return <p className="text-sm text-slate-500">Nessuna certificazione registrata.</p>

  const days = daysToExpiry(cert.expires_on, now)
  const planned = cert.issued_on ? surveillanceDates(cert.issued_on) : null

  return (
    <div className="space-y-5">
      {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <KpiCards
        compact
        className="mb-0"
        items={[
          { key: 'stato', label: 'Stato', value: certificationStatusLabels[cert.status], tone: cert.status === 'certificato' ? 'ok' : 'default' },
          { key: 'fasi', label: 'Fasi completate', value: `${progress.done}/${progress.total}`, hint: progress.overdue.length ? `${progress.overdue.length} in ritardo` : undefined, tone: progress.overdue.length ? 'warn' : 'default' },
          {
            key: 'next',
            label: 'Prossimo passo',
            value: progress.next ? `Fase ${progress.done + 1}` : '—',
            hint: progress.next ? [progress.next.title, progress.next.due_on && `entro il ${fmtDate(progress.next.due_on)}`].filter(Boolean).join(' · ') : 'iter completato',
          },
          {
            key: 'scad',
            label: 'Certificato',
            value: cert.expires_on ? fmtDate(cert.expires_on) : 'Da rilasciare',
            hint: days != null ? (days >= 0 ? `scade tra ${days} giorni` : 'scaduto') : undefined,
            tone: days != null && days < 60 ? 'warn' : cert.expires_on ? 'ok' : 'default',
          },
        ]}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {editing && draft ? (
          <div className="space-y-3">
            <CertificationForm value={draft} onChange={setDraft} />
            <div className="flex gap-2">
              <PrimaryButton
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await updateCertification(cert.id, draft)
                    setEditing(false)
                  })
                }
              >
                Salva
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setEditing(false)}>
                Annulla
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900">{cert.standard}</h2>
                <p className="text-sm text-slate-500">{cert.sector}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[cert.status]}`}>{certificationStatusLabels[cert.status]}</span>
              <SecondaryButton
                size="sm"
                type="button"
                onClick={() => {
                  setDraft(toInput(cert))
                  setEditing(true)
                }}
              >
                Modifica
              </SecondaryButton>
            </div>
            {cert.scope && <p className="text-sm text-slate-700">{cert.scope}</p>}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Ente di certificazione', cert.body || 'da indicare'],
                ['Auditor', cert.auditor || '—'],
                ['Consulente / referente', cert.consultant || '—'],
                ['N. certificato', cert.certificate_number || '—'],
                ['Emesso il', fmtDate(cert.issued_on)],
                ['Scade il', fmtDate(cert.expires_on)],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="break-words font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            {planned && (
              <p className="text-xs text-slate-500">
                Sorveglianze previste: {fmtDate(planned.surveillance1)} e {fmtDate(planned.surveillance2)} · rinnovo entro {fmtDate(planned.renewal)}
              </p>
            )}
            {cert.notes && <p className="whitespace-pre-line text-sm text-slate-600">{cert.notes}</p>}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Fasi dell'iter</h2>
          <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-slate-200">
            {steps.map((s) => (
              <StepRow key={s.id} step={s} files={filesByStep.get(s.id) ?? []} busy={busy} onRun={(fn) => void run(fn)} onOpenFile={(f) => void openFile(f)} />
            ))}
          </ol>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newStep.trim()) return
              const order = (steps.at(-1)?.sort_order ?? 0) + 10
              void run(async () => {
                await addStep(cert.id, newStep.trim(), order, null)
                setNewStep('')
              })
            }}
          >
            <input className={fieldInputClass} placeholder="Aggiungi una fase…" value={newStep} onChange={(e) => setNewStep(e.target.value)} />
            <SecondaryButton type="submit" disabled={busy || !newStep.trim()}>
              Aggiungi
            </SecondaryButton>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Documenti dell'iter</h2>
          <form onSubmit={submitUpload} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <input
              ref={fileInput}
              type="file"
              accept={DOCUMENT_FILE_ACCEPT}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !upload.title) setUpload((u) => ({ ...u, title: f.name.replace(/\.[^.]+$/, '') }))
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Tipo</span>
                <select
                  className={fieldInputClass}
                  value={upload.category}
                  onChange={(e) => setUpload({ ...upload, category: e.target.value as CertificationFileCategory })}
                >
                  {(Object.keys(fileCategoryLabels) as CertificationFileCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {fileCategoryLabels[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Data del documento</span>
                <input type="date" className={fieldInputClass} value={upload.docDate} onChange={(e) => setUpload({ ...upload, docDate: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Titolo</span>
                <input className={fieldInputClass} value={upload.title} onChange={(e) => setUpload({ ...upload, title: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Fase (facoltativa)</span>
                <select className={fieldInputClass} value={upload.stepId} onChange={(e) => setUpload({ ...upload, stepId: e.target.value })}>
                  <option value="">— nessuna —</option>
                  {steps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <PrimaryButton type="submit" disabled={busy || !file}>
              {busy ? 'Carico…' : 'Carica documento'}
            </PrimaryButton>
          </form>
          {!files.length ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Nessun documento ancora.</p>
          ) : (
            filesByCategory.map(([cat, list]) => (
              <div key={cat} className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fileCategoryLabels[cat]}</h3>
                {list.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
                    <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-indigo-700 hover:underline" onClick={() => void openFile(f)}>
                      {f.title}
                    </button>
                    <span className="text-xs text-slate-500">{fmtDate(f.doc_date)}</span>
                    <button
                      type="button"
                      className="text-xs text-slate-400 underline hover:text-red-600"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Cancellare «${f.title}»?`)) void run(() => deleteCertificationFile(f))
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
