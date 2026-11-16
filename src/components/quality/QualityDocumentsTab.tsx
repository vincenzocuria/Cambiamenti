import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PrimaryButton, SecondaryButton } from '../Buttons'
import { fieldInputClass } from '../Field'
import { KpiCards } from '../KpiCards'
import { SegmentedControl } from '../SegmentedControl'
import { fmtDate } from '../../lib/format'
import { describeFilters, exportFilteredList, type ExportColumn } from '../../lib/listExport'
import { DOCUMENT_FILE_ACCEPT } from '../../lib/documentFileTypes'
import {
  areaLabels,
  filterQualityDocuments,
  originLabels,
  qualityProgress,
  reviewOverdue,
  sortQualityDocuments,
  statusLabels,
  type QualityArea,
  type QualityDocument,
  type QualityDocumentInput,
  type QualityFilter,
  type QualityOrigin,
  type QualityStatus,
} from '../../lib/quality'
import {
  createQualityDocument,
  deleteQualityDocument,
  listQualityDocuments,
  qualityFileUrl,
  updateQualityDocument,
  uploadQualityFile,
} from '../../services/quality'

const today = () => new Date().toISOString().slice(0, 10)

const statusTone: Record<QualityStatus, string> = {
  da_predisporre: 'bg-amber-50 text-amber-800',
  bozza: 'bg-sky-50 text-sky-700',
  vigente: 'bg-emerald-50 text-emerald-700',
  superato: 'bg-slate-100 text-slate-500',
}

const emptyInput = (): QualityDocumentInput => ({
  code: '',
  title: '',
  origin: 'interno',
  area: 'direzione',
  iso_clause: '',
  status: 'da_predisporre',
  revision: '',
  issued_on: null,
  review_due_on: null,
  owner: '',
  location: '',
  notes: '',
})

const toInput = (d: QualityDocument): QualityDocumentInput => ({
  code: d.code,
  title: d.title,
  origin: d.origin,
  area: d.area,
  iso_clause: d.iso_clause,
  status: d.status,
  revision: d.revision,
  issued_on: d.issued_on,
  review_due_on: d.review_due_on,
  owner: d.owner,
  location: d.location,
  notes: d.notes,
})

const exportColumns: ExportColumn<QualityDocument>[] = [
  { header: 'Codice', value: (d) => d.code },
  { header: 'Documento', value: (d) => d.title },
  { header: 'Tipo', value: (d) => originLabels[d.origin] },
  { header: 'Area', value: (d) => areaLabels[d.area] },
  { header: 'Punto ISO', value: (d) => d.iso_clause },
  { header: 'Stato', value: (d) => statusLabels[d.status] },
  { header: 'Rev.', value: (d) => d.revision },
  { header: 'Emesso il', value: (d) => fmtDate(d.issued_on) },
  { header: 'Riesame entro', value: (d) => fmtDate(d.review_due_on) },
  { header: 'Responsabile', value: (d) => d.owner },
  { header: 'Dove si trova', value: (d) => d.location || (d.file_name ? `Gestionale: ${d.file_name}` : '') },
]

function DocForm({ value, onChange }: { value: QualityDocumentInput; onChange: (v: QualityDocumentInput) => void }) {
  const set = <K extends keyof QualityDocumentInput>(k: K, v: QualityDocumentInput[K]) => onChange({ ...value, [k]: v })
  const label = 'mb-1 block text-xs font-medium text-slate-600'
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block">
        <span className={label}>Codice</span>
        <input className={fieldInputClass} value={value.code} onChange={(e) => set('code', e.target.value)} placeholder="es. PR-07" />
      </label>
      <label className="block sm:col-span-1 lg:col-span-3">
        <span className={label}>Documento</span>
        <input className={fieldInputClass} value={value.title} onChange={(e) => set('title', e.target.value)} required />
      </label>
      <label className="block">
        <span className={label}>Area</span>
        <select className={fieldInputClass} value={value.area} onChange={(e) => set('area', e.target.value as QualityArea)}>
          {(Object.keys(areaLabels) as QualityArea[]).map((a) => (
            <option key={a} value={a}>
              {areaLabels[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Tipo</span>
        <select className={fieldInputClass} value={value.origin} onChange={(e) => set('origin', e.target.value as QualityOrigin)}>
          <option value="interno">Interno (nostro)</option>
          <option value="esterno">Esterno (norme, enti, fornitori)</option>
        </select>
      </label>
      <label className="block">
        <span className={label}>Stato</span>
        <select className={fieldInputClass} value={value.status} onChange={(e) => set('status', e.target.value as QualityStatus)}>
          {(Object.keys(statusLabels) as QualityStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Punto ISO</span>
        <input className={fieldInputClass} value={value.iso_clause} onChange={(e) => set('iso_clause', e.target.value)} placeholder="es. 7.2" />
      </label>
      <label className="block">
        <span className={label}>Revisione</span>
        <input className={fieldInputClass} value={value.revision} onChange={(e) => set('revision', e.target.value)} placeholder="es. 0" />
      </label>
      <label className="block">
        <span className={label}>Emesso il</span>
        <input type="date" className={fieldInputClass} value={value.issued_on ?? ''} onChange={(e) => set('issued_on', e.target.value || null)} />
      </label>
      <label className="block">
        <span className={label}>Riesame / scadenza entro</span>
        <input type="date" className={fieldInputClass} value={value.review_due_on ?? ''} onChange={(e) => set('review_due_on', e.target.value || null)} />
      </label>
      <label className="block">
        <span className={label}>Responsabile</span>
        <input className={fieldInputClass} value={value.owner} onChange={(e) => set('owner', e.target.value)} />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Dove si trova (se non è caricato)</span>
        <input className={fieldInputClass} value={value.location} onChange={(e) => set('location', e.target.value)} placeholder="es. affissa in aula 1, raccoglitore Qualità" />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Note</span>
        <input className={fieldInputClass} value={value.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </div>
  )
}

export function QualityDocumentsTab() {
  const [docs, setDocs] = useState<QualityDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<QualityDocumentInput>(emptyInput)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<QualityDocumentInput>(emptyInput)
  const [filter, setFilter] = useState<QualityFilter>({ area: 'tutte', status: 'tutti', query: '' })
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploadFor, setUploadFor] = useState<QualityDocument | null>(null)

  const load = useCallback(async () => {
    try {
      setDocs(await listQualityDocuments())
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
  const progress = useMemo(() => qualityProgress(docs, now), [docs, now])
  const shown = useMemo(() => sortQualityDocuments(filterQualityDocuments(docs, filter)), [docs, filter])
  const byArea = useMemo(() => {
    const map = new Map<QualityArea, QualityDocument[]>()
    for (const d of shown) map.set(d.area, [...(map.get(d.area) ?? []), d])
    return [...map.entries()]
  }, [shown])

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

  function submitNew(ev: FormEvent) {
    ev.preventDefault()
    if (!draft.title.trim()) return setError('Scrivi il nome del documento')
    void run(async () => {
      await createQualityDocument({ ...draft, title: draft.title.trim(), code: draft.code.trim() })
      setDraft(emptyInput())
      setShowNew(false)
    })
  }

  function pickFile(d: QualityDocument) {
    setUploadFor(d)
    fileInput.current?.click()
  }

  function onFile(file: File | undefined) {
    const target = uploadFor
    if (fileInput.current) fileInput.current.value = ''
    if (!file || !target) return
    void run(() => uploadQualityFile(target, file))
  }

  async function openFile(d: QualityDocument) {
    try {
      window.open(await qualityFileUrl(d, false), '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apertura non riuscita')
    }
  }

  function remove(d: QualityDocument) {
    if (!window.confirm(`Togliere «${d.title}» dall'elenco${d.file_name ? ' e cancellare il file' : ''}?`)) return
    void run(() => deleteQualityDocument(d))
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: 'Elenco master dei documenti',
      rows: shown,
      columns: exportColumns,
      filters: describeFilters([
        filter.area !== 'tutte' && areaLabels[filter.area],
        filter.status !== 'tutti' && (filter.status === 'mancanti' ? 'da completare' : statusLabels[filter.status]),
        filter.query && `ricerca «${filter.query}»`,
      ]),
      format,
    })
  }

  return (
    <div className="space-y-4">
      <KpiCards
        compact
        className="mb-0"
        items={[
          {
            key: 'pronti',
            label: 'Vigenti',
            value: `${progress.ready}/${progress.total}`,
            hint: 'documenti pronti per l’audit',
            tone: progress.total && progress.ready === progress.total ? 'ok' : 'default',
            onClick: () => setFilter((f) => ({ ...f, status: 'vigente' })),
          },
          {
            key: 'mancanti',
            label: 'Da predisporre',
            value: progress.missing,
            tone: progress.missing ? 'warn' : 'ok',
            onClick: () => setFilter((f) => ({ ...f, status: 'da_predisporre' })),
          },
          {
            key: 'bozza',
            label: 'In bozza',
            value: progress.draft,
            onClick: () => setFilter((f) => ({ ...f, status: 'bozza' })),
          },
          {
            key: 'scaduti',
            label: 'Riesame scaduto',
            value: progress.overdue,
            tone: progress.overdue ? 'warn' : 'ok',
          },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select
          className={`${fieldInputClass} lg:w-64`}
          value={filter.area}
          onChange={(e) => setFilter((f) => ({ ...f, area: e.target.value as QualityFilter['area'] }))}
          aria-label="Area"
        >
          <option value="tutte">Tutte le aree</option>
          {(Object.keys(areaLabels) as QualityArea[]).map((a) => (
            <option key={a} value={a}>
              {areaLabels[a]}
            </option>
          ))}
        </select>
        <SegmentedControl
          ariaLabel="Stato"
          value={filter.status}
          onChange={(status) => setFilter((f) => ({ ...f, status }))}
          options={[
            { value: 'tutti', label: 'Tutti' },
            { value: 'mancanti', label: 'Da completare' },
            { value: 'vigente', label: 'Vigenti' },
            { value: 'superato', label: 'Superati' },
          ]}
        />
        <input
          className={`${fieldInputClass} lg:flex-1`}
          placeholder="Cerca codice, documento, responsabile…"
          value={filter.query}
          onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Chiudi' : 'Nuovo documento'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => exportList('excel')} disabled={!shown.length}>
          Elenco master Excel
        </SecondaryButton>
        <SecondaryButton type="button" onClick={() => exportList('pdf')} disabled={!shown.length}>
          PDF
        </SecondaryButton>
      </div>

      {showNew && (
        <form onSubmit={submitNew} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <DocForm value={draft} onChange={setDraft} />
          <PrimaryButton type="submit" disabled={busy}>
            Aggiungi all'elenco
          </PrimaryButton>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        accept={DOCUMENT_FILE_ACCEPT}
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {loading ? (
        <p className="text-sm text-slate-500">Carico…</p>
      ) : !shown.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Nessun documento con questi filtri.
        </p>
      ) : (
        byArea.map(([area, list]) => (
          <section key={area} className="space-y-2">
            <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{areaLabels[area]}</h2>
            {list.map((d) =>
              editId === d.id ? (
                <div key={d.id} className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
                  <DocForm value={editDraft} onChange={setEditDraft} />
                  <div className="flex gap-2">
                    <PrimaryButton
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await updateQualityDocument(d.id, { ...editDraft, title: editDraft.title.trim() })
                          setEditId(null)
                        })
                      }
                    >
                      Salva
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => setEditId(null)}>
                      Annulla
                    </SecondaryButton>
                  </div>
                </div>
              ) : (
                <div key={d.id} className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${d.status === 'superato' ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    {d.code && <span className="font-mono text-sm font-semibold text-slate-900">{d.code}</span>}
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{d.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone[d.status]}`}>{statusLabels[d.status]}</span>
                    {reviewOverdue(d, now) && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Riesame scaduto</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[
                      originLabels[d.origin],
                      d.iso_clause && `punto ${d.iso_clause}`,
                      d.revision && `rev. ${d.revision}`,
                      d.issued_on && `emesso il ${fmtDate(d.issued_on)}`,
                      d.review_due_on && `riesame entro ${fmtDate(d.review_due_on)}`,
                      d.owner && `resp. ${d.owner}`,
                      d.location,
                      d.notes,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    {d.file_name ? (
                      <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => void openFile(d)}>
                        Apri {d.file_name}
                      </button>
                    ) : (
                      <span className="text-slate-400">Nessun file</span>
                    )}
                    <button type="button" className="text-slate-500 underline hover:text-slate-700" disabled={busy} onClick={() => pickFile(d)}>
                      {d.file_name ? 'Sostituisci file' : 'Carica file'}
                    </button>
                    <button
                      type="button"
                      className="text-slate-500 underline hover:text-slate-700"
                      onClick={() => {
                        setEditId(d.id)
                        setEditDraft(toInput(d))
                      }}
                    >
                      Modifica
                    </button>
                    <button type="button" className="ml-auto text-slate-400 underline hover:text-red-600" disabled={busy} onClick={() => remove(d)}>
                      Elimina
                    </button>
                  </div>
                </div>
              ),
            )}
          </section>
        ))
      )}
    </div>
  )
}
