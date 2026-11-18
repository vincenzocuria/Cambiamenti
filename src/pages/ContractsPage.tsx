import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SecondaryButton } from '../components/Buttons'
import { fieldInputClass } from '../components/Field'
import {
  contractPhase,
  phaseLabels,
  rolesShort,
  statusLabels,
  type CollaborationContract,
} from '../lib/collaborationContract'
import { formatEuro } from '../lib/euroInWords'
import { fmtDate, fullName } from '../lib/format'
import { describeFilters, exportFilteredList, type ExportColumn } from '../lib/listExport'
import { matchesSearch } from '../lib/matchesSearch'
import { listContracts, openContractDocument } from '../services/collaborationContracts'

type PhaseFilter = 'attivi' | 'tutti' | ReturnType<typeof contractPhase>

const phaseTone: Record<ReturnType<typeof contractPhase>, string> = {
  futuro: 'bg-slate-100 text-slate-600',
  in_corso: 'bg-emerald-50 text-emerald-700',
  in_scadenza: 'bg-amber-50 text-amber-700',
  scaduto: 'bg-red-50 text-red-700',
  chiuso: 'bg-slate-100 text-slate-500',
}

const personName = (c: CollaborationContract) => (c.person ? fullName(c.person) : '—')

const exportColumns: ExportColumn<CollaborationContract>[] = [
  { header: 'Collaboratore', value: personName },
  { header: 'Codice fiscale', value: (c) => c.person?.tax_code ?? '' },
  { header: 'Attività', value: (c) => rolesShort(c) },
  { header: 'Dal', value: (c) => fmtDate(c.start_date) },
  { header: 'Al', value: (c) => fmtDate(c.end_date) },
  { header: 'Compenso lordo €', value: (c) => (c.gross_amount != null ? formatEuro(c.gross_amount) : '') },
  { header: 'Corsi', value: (c) => c.courses_text },
  { header: 'Stato', value: (c) => `${statusLabels[c.status]} · ${phaseLabels[contractPhase(c)]}` },
  { header: 'Firmato il', value: (c) => fmtDate(c.signed_on) },
  { header: 'PDF firmato', value: (c) => (c.signed_document_id ? 'sì' : 'no') },
  { header: 'Note', value: (c) => c.notes },
]

export function ContractsPage() {
  const [contracts, setContracts] = useState<CollaborationContract[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<PhaseFilter>('attivi')
  const [query, setQuery] = useState('')

  useEffect(() => {
    listContracts()
      .then(setContracts)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const filtered = useMemo(() => {
    return (contracts ?? []).filter((c) => {
      const p = contractPhase(c)
      if (phase === 'attivi' && (p === 'chiuso' || p === 'scaduto')) return false
      if (phase !== 'attivi' && phase !== 'tutti' && p !== phase) return false
      return matchesSearch([personName(c), c.person?.tax_code ?? '', c.courses_text, c.notes].join(' '), query)
    })
  }, [contracts, phase, query])

  const total = filtered.reduce((sum, c) => sum + (c.gross_amount ?? 0), 0)
  const expiring = (contracts ?? []).filter((c) => contractPhase(c) === 'in_scadenza').length

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: 'Contratti di collaborazione',
      rows: filtered,
      columns: exportColumns,
      filters: describeFilters([
        phase !== 'tutti' && (phase === 'attivi' ? 'attivi' : phaseLabels[phase]),
        query && `ricerca «${query}»`,
      ]),
      format,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contratti di collaborazione</h1>
          <p className="text-sm text-slate-500">
            Contratti co.co.co. del personale. Si creano e si generano dalla scheda della persona in Personale.
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton size="sm" onClick={() => exportList('excel')}>
            Excel
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => exportList('pdf')}>
            PDF
          </SecondaryButton>
        </div>
      </div>

      {expiring > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {expiring === 1 ? '1 contratto scade' : `${expiring} contratti scadono`} entro 60 giorni: valuta proroga o nuovo contratto.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <select className={`${fieldInputClass} w-auto`} value={phase} onChange={(e) => setPhase(e.target.value as PhaseFilter)}>
          <option value="attivi">Attivi e da iniziare</option>
          <option value="tutti">Tutti</option>
          {Object.entries(phaseLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          className={`${fieldInputClass} w-64`}
          placeholder="Cerca collaboratore, corso…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!contracts ? (
        <p className="text-slate-400">Caricamento…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun contratto con questi filtri.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Collaboratore</th>
                <th className="px-3 py-2">Attività</th>
                <th className="px-3 py-2">Periodo</th>
                <th className="px-3 py-2 text-right">Compenso lordo</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">PDF firmato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const p = contractPhase(c)
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      <Link to={`/personale/${c.person_id}`} className="font-medium text-indigo-600 hover:underline">
                        {personName(c)}
                      </Link>
                      {c.courses_text && <p className="text-xs text-slate-400">{c.courses_text}</p>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{rolesShort(c)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {fmtDate(c.start_date)} → {c.end_date ? fmtDate(c.end_date) : '…'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-700">
                      {c.gross_amount != null ? `€ ${formatEuro(c.gross_amount)}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${phaseTone[p]}`}>{phaseLabels[p]}</span>
                      <span className="ml-1 text-xs text-slate-500">{statusLabels[c.status]}</span>
                    </td>
                    <td className="px-3 py-2">
                      {c.signed_document_id ? (
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:underline"
                          onClick={() => void openContractDocument(c.signed_document_id!).catch((e) => setError(String(e)))}
                        >
                          Apri
                        </button>
                      ) : (
                        <span className="text-xs text-amber-700">manca</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-slate-50 text-sm">
              <tr>
                <td className="px-3 py-2 font-medium text-slate-600" colSpan={3}>
                  Totale ({filtered.length})
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">€ {formatEuro(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
