import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EipassCandidate, EipassCandidateInput } from '../types/db'
import {
  createEipassCandidate,
  listEipassCandidates,
} from '../services/eipass'
import { invoiceStatusLabels, nextInvoiceNumber, paymentMethodLabel } from '../lib/eipassInvoice'
import { listPersonIdsWithDocument } from '../services/documents'
import { importInvoiceFiles } from '../services/invoiceImport'
import { suggestNextInvoiceNumber } from '../services/invoiceNumbering'
import { fmtDate, fullName } from '../lib/format'
import { matchesSearch } from '../lib/matchesSearch'
import { describeFilters, exportFilteredList } from '../lib/listExport'
import {
  checkStudentDocuments,
  studentDocumentExportValue,
} from '../lib/studentDocumentStatus'
import {
  eipassExamLabel,
  eipassStatusLabels,
  isEipassListStatus,
  type EipassListStatus,
} from '../lib/eipassStatus'
import { useListQuery } from '../hooks/useListQuery'
import { usePagedSlice } from '../hooks/usePagedSlice'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { EipassExamBadge, InvoiceStatusBadge } from '../components/EipassExamBadge'
import { EipassForm } from '../components/EipassForm'
import { EmailLink, WhatsAppLink } from '../components/ContactLinks'
import { PrimaryButton, SecondaryButton } from '../components/Buttons'
import { KpiCards } from '../components/KpiCards'
import { ListToolbar } from '../components/ListToolbar'
import { ListPagination } from '../components/ListPagination'
import {
  tableWideClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadRowClass,
  trClass,
} from '../lib/tableStyles'

export function EipassListPage() {
  const [candidates, setCandidates] = useState<EipassCandidate[]>([])
  const [identityIds, setIdentityIds] = useState<Set<string>>(() => new Set())
  const [certificateIds, setCertificateIds] = useState<Set<string>>(() => new Set())
  const [creating, setCreating] = useState(false)
  const [importReport, setImportReport] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [suggestedNumber, setSuggestedNumber] = useState('')
  const { search, status: rawStatus, setSearch, setStatus } = useListQuery()
  const status: EipassListStatus | '' = isEipassListStatus(rawStatus) ? rawStatus : ''

  async function reload() {
    const [rows, ids, certIds] = await Promise.all([
      listEipassCandidates(),
      listPersonIdsWithDocument('eipass', 'identity'),
      listPersonIdsWithDocument('eipass', 'certificate'),
    ])
    setCandidates(rows)
    setIdentityIds(ids)
    setCertificateIds(certIds)
  }

  useEffect(() => {
    void reload()
    suggestNextInvoiceNumber(new Date().getFullYear())
      .then((r) => setSuggestedNumber(r.number))
      .catch(() => setSuggestedNumber(''))
  }, [])

  function suggestInvoiceNumber(): string {
    return suggestedNumber || nextInvoiceNumber(candidates, new Date().getFullYear())
  }

  /** Importa le fatture scaricate da Aruba (XML, P7M o ZIP) e segna i corsisti come fatturati. */
  async function handleImport() {
    const files = Array.from(importRef.current?.files ?? [])
    if (files.length === 0) return
    setImporting(true)
    let report: string[] = []
    try {
      const res = await importInvoiceFiles(files)
      report = [
        `${res.added + res.updated} fatture lette (aggiunte anche in Fatturazione), ${res.eipassLinked} abbinate a corsisti EIPASS.`,
        ...res.report,
      ]
    } catch (err) {
      report = [err instanceof Error ? err.message : 'Importazione non riuscita']
    } finally {
      if (importRef.current) importRef.current.value = ''
      setImportReport(report)
      setImporting(false)
      await reload()
      suggestNextInvoiceNumber(new Date().getFullYear())
        .then((r) => setSuggestedNumber(r.number))
        .catch(() => undefined)
    }
  }

  async function handleCreate(input: EipassCandidateInput) {
    await createEipassCandidate(input)
    setCreating(false)
    await reload()
  }

  const docCheck = useMemo(
    () => (c: EipassCandidate) => checkStudentDocuments(c, identityIds.has(c.id)),
    [identityIds],
  )

  const searched = useMemo(
    () =>
      candidates.filter((c) =>
        matchesSearch(
          `${c.first_name} ${c.last_name} ${c.tax_code} ${c.email} ${c.phone} ${c.certification} ${c.certificate_type}`,
          search,
        ),
      ),
    [candidates, search],
  )

  const filtered = useMemo(
    () =>
      searched.filter((c) => {
        if (status === 'esame_fatto') return c.exam_done
        if (status === 'esame_da_fare') return !c.exam_done
        if (status === 'documenti_ok') return docCheck(c).ok
        if (status === 'documenti_mancanti') return !docCheck(c).ok
        if (status === 'da_fatturare') return c.invoice_status === 'da_fatturare'
        if (status === 'fatturato') return c.invoice_status === 'fatturato'
        return true
      }),
    [searched, status, docCheck],
  )

  const counts = useMemo(() => {
    let examDone = 0
    let docsMissing = 0
    let toInvoice = 0
    for (const c of candidates) {
      if (c.exam_done) examDone += 1
      if (!docCheck(c).ok) docsMissing += 1
      if (c.invoice_status === 'da_fatturare') toInvoice += 1
    }
    return { examDone, examTodo: candidates.length - examDone, docsMissing, toInvoice }
  }, [candidates, docCheck])

  const { page, setPage, pages, slice, pageSize } = usePagedSlice(
    filtered,
    `${search}|${status}|${identityIds.size}|${certificateIds.size}`,
  )

  function toggleStatus(key: EipassListStatus) {
    setStatus(status === key ? '' : key)
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: 'EIPASS privato',
      rows: filtered,
      format,
      filters: describeFilters([status && eipassStatusLabels[status], search && `ricerca «${search}»`]),
      columns: [
        { header: 'Nominativo', value: (c) => fullName(c) },
        { header: 'Codice fiscale', value: (c) => c.tax_code || '' },
        { header: 'Certificazione', value: (c) => c.certification || '' },
        { header: 'Attestato conseguito', value: (c) => c.certificate_type || '' },
        { header: 'Scadenza attestato', value: (c) => (c.certificate_expiry ? fmtDate(c.certificate_expiry) : '') },
        { header: 'Data acquisto', value: (c) => fmtDate(c.purchase_date) },
        { header: 'Esame', value: (c) => eipassExamLabel(c) },
        { header: 'Data esame', value: (c) => (c.exam_done ? fmtDate(c.exam_date) : '') },
        {
          header: 'Importo',
          value: (c) => (c.amount != null ? c.amount.toFixed(2).replace('.', ',') : ''),
        },
        { header: 'Pagamento', value: (c) => paymentMethodLabel(c.payment_method) },
        { header: 'Data pagamento', value: (c) => fmtDate(c.payment_date) },
        { header: 'Fattura', value: (c) => invoiceStatusLabels[c.invoice_status] ?? '' },
        { header: 'Numero fattura', value: (c) => c.invoice_number || '' },
        { header: 'Data fattura', value: (c) => fmtDate(c.invoice_date) },
        { header: 'Attestato', value: (c) => (certificateIds.has(c.id) ? 'Caricato' : '') },
        { header: 'Telefono', value: (c) => c.phone || '' },
        { header: 'Email', value: (c) => c.email || '' },
        { header: 'Documenti', value: (c) => studentDocumentExportValue(docCheck(c)) },
      ],
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">EIPASS privato</h1>
        {!creating && (
          <PrimaryButton onClick={() => setCreating(true)}>+ Nuovo corsista</PrimaryButton>
        )}
      </div>

      <KpiCards
        items={[
          {
            key: 'totale',
            label: 'Corsisti EIPASS',
            hint: 'Acquisti privati',
            value: candidates.length,
            active: !status,
            onClick: () => setStatus(''),
          },
          {
            key: 'esame_fatto',
            label: 'Esame fatto',
            hint: 'Certificazione sostenuta',
            value: counts.examDone,
            tone: 'ok',
            active: status === 'esame_fatto',
            onClick: () => toggleStatus('esame_fatto'),
          },
          {
            key: 'esame_da_fare',
            label: 'Esame da fare',
            hint: 'In attesa di sostenerlo',
            value: counts.examTodo,
            tone: counts.examTodo > 0 ? 'warn' : 'ok',
            active: status === 'esame_da_fare',
            onClick: () => toggleStatus('esame_da_fare'),
          },
          {
            key: 'da_fatturare',
            label: 'Da fatturare',
            hint: 'Fattura da emettere',
            value: counts.toInvoice,
            tone: counts.toInvoice > 0 ? 'warn' : 'ok',
            active: status === 'da_fatturare',
            onClick: () => toggleStatus('da_fatturare'),
          },
          {
            key: 'documenti_mancanti',
            label: 'Documenti mancanti',
            hint: 'File assente, dati incompleti o scadenza',
            value: counts.docsMissing,
            tone: counts.docsMissing > 0 ? 'warn' : 'ok',
            active: status === 'documenti_mancanti',
            onClick: () => toggleStatus('documenti_mancanti'),
          },
        ]}
      />

      {creating && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-700">Nuovo corsista EIPASS</h2>
          <EipassForm
            suggestInvoiceNumber={suggestInvoiceNumber}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <span className="font-medium text-slate-700">Fatture da Aruba</span>
        <input ref={importRef} type="file" accept=".xml,.p7m,.zip" multiple className="hidden" onChange={() => void handleImport()} />
        <SecondaryButton size="sm" disabled={importing} onClick={() => importRef.current?.click()}>
          {importing ? 'Importazione…' : 'Importa XML fatture'}
        </SecondaryButton>
        <span className="text-xs text-slate-500">
          Scarica da Aruba le fatture emesse (XML, P7M o lo ZIP così com'è): ognuna viene abbinata al
          corsista con lo stesso codice fiscale, che passa a «Fatturato» con numero e data. Importale
          prima di fatturare: il numero successivo si calcola da qui.
        </span>
        {importReport.length > 0 && (
          <ul className="w-full list-disc space-y-1 pl-5 text-xs text-slate-600">
            {importReport.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Cerca per nome, codice fiscale, email, telefono o certificazione…"
        resultCount={filtered.length}
        totalCount={candidates.length}
        unitSingular="corsista"
        unitPlural="corsisti"
        onExportExcel={() => exportList('excel')}
        onExportPdf={() => exportList('pdf')}
      />

      <div className={tableWrapClass}>
        <table className={tableWideClass}>
          <thead>
            <tr className={theadRowClass}>
              <th className={thClass}>Nominativo</th>
              <th className={thClass}>Codice fiscale</th>
              <th className={thClass}>Certificazione</th>
              <th className={thClass}>Acquisto</th>
              <th className={thClass}>Telefono</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Esame</th>
              <th className={thClass}>Fattura</th>
              <th className={thClass}>Documenti</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((c) => (
              <tr key={c.id} className={trClass}>
                <td className={tdClass}>
                  <Link
                    to={`/eipass/${c.id}`}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {fullName(c)}
                  </Link>
                </td>
                <td className={`${tdClass} font-mono text-xs tracking-wide`}>
                  {c.tax_code || '—'}
                </td>
                <td className={tdClass}>{c.certification || '—'}</td>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  {fmtDate(c.purchase_date)}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  <WhatsAppLink value={c.phone} />
                </td>
                <td className={`${tdClass} break-all`}>
                  <EmailLink value={c.email} />
                </td>
                <td className={tdClass}>
                  <EipassExamBadge candidate={c} />
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-0.5">
                    <InvoiceStatusBadge status={c.invoice_status} />
                    {c.invoice_number && (
                      <span className="text-xs text-slate-500">n. {c.invoice_number}</span>
                    )}
                  </div>
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-0.5">
                    <DocumentStatusBadge check={docCheck(c)} personName={fullName(c)} />
                    {certificateIds.has(c.id) && (
                      <span className="text-xs text-indigo-700">Attestato caricato</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className={`${tdClass} py-10 text-center text-slate-400`}>
                  {candidates.length === 0
                    ? 'Nessun corsista EIPASS in anagrafica.'
                    : 'Nessun risultato per i filtri selezionati.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ListPagination
        page={page}
        pages={pages}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
      />
    </div>
  )
}
