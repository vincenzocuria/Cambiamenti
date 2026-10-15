import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EipassCandidate, EipassCandidateInput } from '../types/db'
import { createEipassCandidate, listEipassCandidates } from '../services/eipass'
import { listPersonIdsWithDocument } from '../services/documents'
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
import { EipassExamBadge } from '../components/EipassExamBadge'
import { EipassForm } from '../components/EipassForm'
import { EmailLink, WhatsAppLink } from '../components/ContactLinks'
import { PrimaryButton } from '../components/Buttons'
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
  const [creating, setCreating] = useState(false)
  const { search, status: rawStatus, setSearch, setStatus } = useListQuery()
  const status: EipassListStatus | '' = isEipassListStatus(rawStatus) ? rawStatus : ''

  async function reload() {
    const [rows, ids] = await Promise.all([
      listEipassCandidates(),
      listPersonIdsWithDocument('eipass', 'identity'),
    ])
    setCandidates(rows)
    setIdentityIds(ids)
  }

  useEffect(() => {
    void reload()
  }, [])

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
          `${c.first_name} ${c.last_name} ${c.tax_code} ${c.email} ${c.phone} ${c.certification}`,
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
        return true
      }),
    [searched, status, docCheck],
  )

  const counts = useMemo(() => {
    let examDone = 0
    let docsMissing = 0
    for (const c of candidates) {
      if (c.exam_done) examDone += 1
      if (!docCheck(c).ok) docsMissing += 1
    }
    return { examDone, examTodo: candidates.length - examDone, docsMissing }
  }, [candidates, docCheck])

  const { page, setPage, pages, slice, pageSize } = usePagedSlice(
    filtered,
    `${search}|${status}|${identityIds.size}`,
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
        { header: 'Data acquisto', value: (c) => fmtDate(c.purchase_date) },
        { header: 'Esame', value: (c) => eipassExamLabel(c) },
        { header: 'Data esame', value: (c) => (c.exam_done ? fmtDate(c.exam_date) : '') },
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
          <EipassForm onSave={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

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
                  <DocumentStatusBadge check={docCheck(c)} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className={`${tdClass} py-10 text-center text-slate-400`}>
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
