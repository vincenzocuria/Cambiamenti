import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PrimaryButton, SecondaryButton } from '../components/Buttons'
import { fieldInputClass } from '../components/Field'
import { KpiCards } from '../components/KpiCards'
import { SegmentedControl } from '../components/SegmentedControl'
import { DocumentPreview } from '../components/DocumentPreview'
import { fmtBytes, fmtDate } from '../lib/format'
import { describeFilters, exportFilteredList, type ExportColumn } from '../lib/listExport'
import { canPreviewDocument, DOCUMENT_FILE_ACCEPT } from '../lib/documentFileTypes'
import { todayIso } from '../lib/todos'
import {
  categoryOrder,
  companyCategoryHints,
  companyCategoryLabels,
  companyProgress,
  expiryLabel,
  expiryState,
  filterCompanyDocuments,
  renewalInput,
  sortCompanyDocuments,
  suggestedExpiry,
  type CompanyDocCategory,
  type CompanyDocument,
  type CompanyDocumentInput,
  type CompanyFilter,
  type ExpiryState,
} from '../lib/companyDocuments'
import {
  companyFileUrl,
  createCompanyDocument,
  deleteCompanyDocument,
  listCompanyDocuments,
  renewCompanyDocument,
  updateCompanyDocument,
  uploadCompanyFile,
} from '../services/companyDocuments'
import { listQualityDocuments } from '../services/quality'
import type { QualityDocument } from '../lib/quality'

const emptyInput = (category: CompanyDocCategory = 'societari'): CompanyDocumentInput => ({
  category,
  title: '',
  issuer: '',
  reference: '',
  issued_on: null,
  expires_on: null,
  notes: '',
  quality_document_id: null,
})

const toInput = (d: CompanyDocument): CompanyDocumentInput => ({
  category: d.category,
  title: d.title,
  issuer: d.issuer,
  reference: d.reference,
  issued_on: d.issued_on,
  expires_on: d.expires_on,
  notes: d.notes,
  quality_document_id: d.quality_document_id,
})

const expiryTone: Record<Exclude<ExpiryState, null>, string> = {
  scaduto: 'bg-red-50 text-red-700',
  in_scadenza: 'bg-amber-50 text-amber-800',
  valido: 'bg-emerald-50 text-emerald-700',
}

const views: { value: CompanyFilter['view']; label: string }[] = [
  { value: 'correnti', label: 'Correnti' },
  { value: 'da_caricare', label: 'Da caricare' },
  { value: 'scadenze', label: 'Scadenze' },
  { value: 'superati', label: 'Versioni precedenti' },
]

function DocForm({
  value,
  onChange,
  quality,
}: {
  value: CompanyDocumentInput
  onChange: (v: CompanyDocumentInput) => void
  quality: QualityDocument[]
}) {
  const set = <K extends keyof CompanyDocumentInput>(k: K, v: CompanyDocumentInput[K]) => onChange({ ...value, [k]: v })
  const label = 'mb-1 block text-xs font-medium text-slate-600'

  function setIssued(issued: string | null) {
    // per i documenti con durata fissa (es. DURC 120 giorni) propone la scadenza
    const suggestion = value.expires_on ? null : suggestedExpiry(value.title, issued)
    onChange({ ...value, issued_on: issued, expires_on: suggestion ?? value.expires_on })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block sm:col-span-2">
        <span className={label}>Documento</span>
        <input
          className={fieldInputClass}
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="es. Visura camerale, DURC, Polizza RC"
          required
        />
      </label>
      <label className="block">
        <span className={label}>Categoria</span>
        <select className={fieldInputClass} value={value.category} onChange={(e) => set('category', e.target.value as CompanyDocCategory)}>
          {categoryOrder.map((c) => (
            <option key={c} value={c}>
              {companyCategoryLabels[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Rilasciato da</span>
        <input className={fieldInputClass} value={value.issuer} onChange={(e) => set('issuer', e.target.value)} placeholder="es. Camera di Commercio" />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Numero / protocollo / decreto</span>
        <input className={fieldInputClass} value={value.reference} onChange={(e) => set('reference', e.target.value)} placeholder="es. DD n. 1234 del 05/03/2024" />
      </label>
      <label className="block">
        <span className={label}>Rilasciato il</span>
        <input type="date" className={fieldInputClass} value={value.issued_on ?? ''} onChange={(e) => setIssued(e.target.value || null)} />
      </label>
      <label className="block">
        <span className={label}>Scade il</span>
        <input type="date" className={fieldInputClass} value={value.expires_on ?? ''} onChange={(e) => set('expires_on', e.target.value || null)} />
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Vale anche per la Qualità ISO 9001 come</span>
        <select
          className={fieldInputClass}
          value={value.quality_document_id ?? ''}
          onChange={(e) => set('quality_document_id', e.target.value || null)}
        >
          <option value="">— nessun collegamento —</option>
          {quality.map((q) => (
            <option key={q.id} value={q.id}>
              {[q.code, q.title].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className={label}>Note</span>
        <input className={fieldInputClass} value={value.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </div>
  )
}

/** Documenti della società: visura, statuto, DURC, accreditamento, polizze, sede, privacy... */
export function CompanyDocumentsPage() {
  const [params, setParams] = useSearchParams()
  const [docs, setDocs] = useState<CompanyDocument[]>([])
  const [quality, setQuality] = useState<QualityDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<CompanyDocumentInput>(() => emptyInput())
  const [draftFile, setDraftFile] = useState<File | null>(null)
  const [renewing, setRenewing] = useState<CompanyDocument | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<CompanyDocumentInput>(() => emptyInput())
  const [preview, setPreview] = useState<CompanyDocument | null>(null)
  const rawView = params.get('vista')
  const [filter, setFilter] = useState<CompanyFilter>({
    category: 'tutte',
    view: views.some((v) => v.value === rawView) ? (rawView as CompanyFilter['view']) : 'correnti',
    query: '',
  })
  const fileInput = useRef<HTMLInputElement>(null)
  const newFileInput = useRef<HTMLInputElement>(null)
  const [uploadFor, setUploadFor] = useState<CompanyDocument | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, q] = await Promise.all([listCompanyDocuments(), listQualityDocuments().catch(() => [])])
      setDocs(list)
      setQuality([...q].filter((d) => d.status !== 'superato').sort((a, b) => a.code.localeCompare(b.code)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const now = todayIso()
  const progress = useMemo(() => companyProgress(docs, now), [docs, now])
  const shown = useMemo(() => sortCompanyDocuments(filterCompanyDocuments(docs, filter, now)), [docs, filter, now])
  const byCategory = useMemo(() => {
    const map = new Map<CompanyDocCategory, CompanyDocument[]>()
    for (const d of shown) map.set(d.category, [...(map.get(d.category) ?? []), d])
    return [...map.entries()]
  }, [shown])
  const qualityById = useMemo(() => new Map(quality.map((q) => [q.id, q])), [quality])

  function setView(view: CompanyFilter['view']) {
    setFilter((f) => ({ ...f, view }))
    setParams(view === 'correnti' ? {} : { vista: view }, { replace: true })
  }

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

  function openNew(category?: CompanyDocCategory) {
    setRenewing(null)
    setDraft(emptyInput(category ?? (filter.category === 'tutte' ? 'societari' : filter.category)))
    setDraftFile(null)
    setShowNew(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openRenew(d: CompanyDocument) {
    setRenewing(d)
    setDraft(renewalInput(d))
    setDraftFile(null)
    setShowNew(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeNew() {
    setShowNew(false)
    setRenewing(null)
    setDraftFile(null)
    if (newFileInput.current) newFileInput.current.value = ''
  }

  function submitNew(ev: FormEvent) {
    ev.preventDefault()
    if (!draft.title.trim()) return setError('Scrivi il nome del documento')
    const input = { ...draft, title: draft.title.trim(), issuer: draft.issuer.trim(), reference: draft.reference.trim() }
    const file = draftFile
    const old = renewing
    void run(async () => {
      const created = old ? await renewCompanyDocument(old, input) : await createCompanyDocument(input)
      if (file) await uploadCompanyFile(created, file)
      closeNew()
    })
  }

  function pickFile(d: CompanyDocument) {
    setUploadFor(d)
    fileInput.current?.click()
  }

  function onFile(file: File | undefined) {
    const target = uploadFor
    if (fileInput.current) fileInput.current.value = ''
    if (!file || !target) return
    void run(() => uploadCompanyFile(target, file))
  }

  async function openFile(d: CompanyDocument) {
    if (d.storage_path && canPreviewDocument(d.file_name, d.mime_type)) return setPreview(d)
    try {
      window.open(await companyFileUrl(d, false), '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apertura non riuscita')
    }
  }

  async function downloadFile(d: CompanyDocument) {
    try {
      window.location.href = await companyFileUrl(d, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download non riuscito')
    }
  }

  function remove(d: CompanyDocument) {
    if (!window.confirm(`Eliminare «${d.title}»${d.file_name ? ' e il suo file' : ''}? Non si può annullare.`)) return
    void run(() => deleteCompanyDocument(d))
  }

  function restore(d: CompanyDocument) {
    void run(() => updateCompanyDocument(d.id, { superseded_at: null }))
  }

  const exportColumns: ExportColumn<CompanyDocument>[] = [
    { header: 'Categoria', value: (d) => companyCategoryLabels[d.category] },
    { header: 'Documento', value: (d) => d.title },
    { header: 'Rilasciato da', value: (d) => d.issuer },
    { header: 'Numero / protocollo', value: (d) => d.reference },
    { header: 'Rilasciato il', value: (d) => fmtDate(d.issued_on) },
    { header: 'Scade il', value: (d) => fmtDate(d.expires_on) },
    { header: 'File', value: (d) => d.file_name || 'da caricare' },
    { header: 'ISO 9001', value: (d) => qualityById.get(d.quality_document_id ?? '')?.code ?? '' },
    { header: 'Note', value: (d) => d.notes },
  ]

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: 'Documenti della società',
      rows: shown,
      columns: exportColumns,
      filters: describeFilters([
        filter.category !== 'tutte' && companyCategoryLabels[filter.category],
        filter.view !== 'correnti' && views.find((v) => v.value === filter.view)?.label,
        filter.query && `ricerca «${filter.query}»`,
      ]),
      format,
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Documenti della società</h1>
        <p className="text-sm text-slate-500">
          I documenti di Cambia-Menti che non riguardano un corso o una persona: visura, statuto, DURC, accreditamento,
          polizze, sede, privacy e convenzioni. Con la data di scadenza il gestionale avvisa per tempo; con «Rinnova» la
          versione nuova prende il posto della vecchia, che resta nello storico.
        </p>
      </div>

      <KpiCards
        compact
        className="mb-0"
        items={[
          {
            key: 'caricati',
            label: 'Caricati',
            value: `${progress.loaded}/${progress.total}`,
            hint: 'documenti con il file nel gestionale',
            tone: progress.total && progress.loaded === progress.total ? 'ok' : 'default',
            onClick: () => setView('correnti'),
            active: filter.view === 'correnti',
          },
          {
            key: 'mancanti',
            label: 'Da caricare',
            value: progress.missing,
            tone: progress.missing ? 'warn' : 'ok',
            onClick: () => setView('da_caricare'),
            active: filter.view === 'da_caricare',
          },
          {
            key: 'scadenza',
            label: 'In scadenza',
            value: progress.expiring,
            hint: 'entro 30 giorni',
            tone: progress.expiring ? 'warn' : 'ok',
            onClick: () => setView('scadenze'),
            active: filter.view === 'scadenze',
          },
          {
            key: 'scaduti',
            label: 'Scaduti',
            value: progress.expired,
            tone: progress.expired ? 'warn' : 'ok',
            onClick: () => setView('scadenze'),
          },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select
          className={`${fieldInputClass} lg:w-64`}
          value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value as CompanyFilter['category'] }))}
          aria-label="Categoria"
        >
          <option value="tutte">Tutte le categorie</option>
          {categoryOrder.map((c) => (
            <option key={c} value={c}>
              {companyCategoryLabels[c]}
            </option>
          ))}
        </select>
        <SegmentedControl ariaLabel="Vista" value={filter.view} onChange={setView} options={views} />
        <input
          className={`${fieldInputClass} lg:flex-1`}
          placeholder="Cerca documento, ente, numero…"
          value={filter.query}
          onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={() => (showNew ? closeNew() : openNew())}>
          {showNew ? 'Chiudi' : 'Nuovo documento'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => exportList('excel')} disabled={!shown.length}>
          Elenco Excel
        </SecondaryButton>
        <SecondaryButton type="button" onClick={() => exportList('pdf')} disabled={!shown.length}>
          PDF
        </SecondaryButton>
      </div>

      {showNew && (
        <form onSubmit={submitNew} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {renewing && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
              Rinnovo di «{renewing.title}»
              {renewing.issued_on ? ` del ${fmtDate(renewing.issued_on)}` : ''}: la versione attuale passerà tra le versioni
              precedenti, con il suo file.
            </p>
          )}
          <DocForm value={draft} onChange={setDraft} quality={quality} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">File (PDF, Word, immagine, .p7m)</span>
            <input
              ref={newFileInput}
              type="file"
              accept={DOCUMENT_FILE_ACCEPT}
              onChange={(e) => setDraftFile(e.target.files?.[0] ?? null)}
              className="block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </label>
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={busy}>
              {renewing ? 'Salva la nuova versione' : 'Aggiungi'}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={closeNew}>
              Annulla
            </SecondaryButton>
          </div>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <input ref={fileInput} type="file" className="hidden" accept={DOCUMENT_FILE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0])} />

      {loading ? (
        <p className="text-sm text-slate-500">Carico…</p>
      ) : !shown.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {filter.view === 'scadenze'
            ? 'Nessun documento scaduto o in scadenza nei prossimi 30 giorni.'
            : 'Nessun documento con questi filtri.'}
        </p>
      ) : (
        byCategory.map(([category, list]) => (
          <section key={category} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3 pt-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{companyCategoryLabels[category]}</h2>
              {companyCategoryHints[category] && <span className="text-xs text-slate-400">{companyCategoryHints[category]}</span>}
              {filter.view === 'correnti' && (
                <button type="button" className="ml-auto text-xs text-indigo-600 hover:underline" onClick={() => openNew(category)}>
                  + Aggiungi qui
                </button>
              )}
            </div>
            {list.map((d) => {
              const exp = expiryState(d, now)
              const iso = d.quality_document_id ? qualityById.get(d.quality_document_id) : undefined
              return editId === d.id ? (
                <div key={d.id} className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
                  <DocForm value={editDraft} onChange={setEditDraft} quality={quality} />
                  <div className="flex gap-2">
                    <PrimaryButton
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          if (!editDraft.title.trim()) throw new Error('Scrivi il nome del documento')
                          await updateCompanyDocument(d.id, { ...editDraft, title: editDraft.title.trim() })
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
                <div key={d.id} className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${d.superseded_at ? 'opacity-70' : ''}`}>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{d.title}</span>
                    {!d.storage_path && !d.superseded_at && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Da caricare</span>
                    )}
                    {exp && d.expires_on && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${expiryTone[exp]}`}>
                        {exp === 'valido' ? `valido fino al ${fmtDate(d.expires_on)}` : expiryLabel(d.expires_on, now)}
                      </span>
                    )}
                    {d.superseded_at && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Sostituito il {fmtDate(d.superseded_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {[
                      d.issuer,
                      d.reference,
                      d.issued_on && `rilasciato il ${fmtDate(d.issued_on)}`,
                      d.expires_on && exp !== 'valido' && `scadenza ${fmtDate(d.expires_on)}`,
                      iso && `ISO 9001: ${iso.code || iso.title}`,
                      d.notes,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    {d.storage_path ? (
                      <>
                        <button type="button" className="max-w-full truncate font-medium text-indigo-600 hover:underline" onClick={() => void openFile(d)}>
                          Apri {d.file_name}
                        </button>
                        <span className="text-slate-400">{fmtBytes(d.size_bytes)}</span>
                        <button type="button" className="text-slate-500 underline hover:text-slate-700" onClick={() => void downloadFile(d)}>
                          Scarica
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400">Nessun file</span>
                    )}
                    {!d.superseded_at && (
                      <>
                        <button type="button" className="text-slate-500 underline hover:text-slate-700" disabled={busy} onClick={() => pickFile(d)}>
                          {d.storage_path ? 'Sostituisci file' : 'Carica file'}
                        </button>
                        {d.storage_path && (
                          <button type="button" className="text-slate-500 underline hover:text-slate-700" disabled={busy} onClick={() => openRenew(d)}>
                            Rinnova
                          </button>
                        )}
                      </>
                    )}
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
                    {d.superseded_at && (
                      <button type="button" className="text-slate-500 underline hover:text-slate-700" disabled={busy} onClick={() => restore(d)}>
                        Rimetti tra i correnti
                      </button>
                    )}
                    <button type="button" className="ml-auto text-slate-400 underline hover:text-red-600" disabled={busy} onClick={() => remove(d)}>
                      Elimina
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        ))
      )}

      {preview && preview.storage_path && (
        <DocumentPreview doc={{ ...preview, storage_path: preview.storage_path }} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}
