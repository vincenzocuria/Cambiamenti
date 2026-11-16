import { useCallback, useEffect, useMemo, useState } from 'react'
import { SecondaryButton } from '../Buttons'
import { fieldInputClass } from '../Field'
import { KpiCards } from '../KpiCards'
import { SegmentedControl } from '../SegmentedControl'
import { CertificatesList } from './CertificatesList'
import { describeFilters, exportFilteredList } from '../../lib/listExport'
import { certificateExportColumns } from '../../lib/certificateExport'
import {
  filterCertificates,
  sortCertificates,
  type Certificate,
  type DeliveryFilter,
} from '../../lib/quality'
import { listCertificates } from '../../services/quality'


export function CertificatesTab() {
  const [rows, setRows] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState<number | 'tutti'>('tutti')
  const [delivery, setDelivery] = useState<DeliveryFilter>('tutti')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await listCertificates())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => r.year))
    set.add(thisYear)
    return [...set].sort((a, b) => b - a)
  }, [rows, thisYear])
  const shown = useMemo(() => sortCertificates(filterCertificates(rows, { year, delivery, query })), [rows, year, delivery, query])
  const valid = rows.filter((c) => !c.cancelled_at)
  const toDeliver = valid.filter((c) => !c.delivered_on).length

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: `Registro attestati${year === 'tutti' ? '' : ` ${year}`}`,
      rows: [...shown].reverse(),
      columns: certificateExportColumns,
      filters: describeFilters([year !== 'tutti' && `anno ${year}`, delivery !== 'tutti' && delivery.replace('_', ' '), query && `ricerca «${query}»`]),
      format,
    })
  }

  return (
    <div className="space-y-4">
      <KpiCards
        compact
        className="mb-0"
        items={[
          { key: 'tot', label: 'Attestati rilasciati', value: valid.length, onClick: () => setDelivery('tutti') },
          { key: 'cons', label: 'Consegnati', value: valid.length - toDeliver, tone: 'ok', onClick: () => setDelivery('consegnati') },
          { key: 'da', label: 'Da consegnare', value: toDeliver, tone: toDeliver ? 'warn' : 'ok', onClick: () => setDelivery('da_consegnare') },
          { key: 'ann', label: 'Annullati', value: rows.length - valid.length, onClick: () => setDelivery('annullati') },
        ]}
      />
      <p className="text-sm text-slate-500">
        I numeri (N/anno) si assegnano dalla scheda del corso, sezione «Qualità»: un attestato per ogni allievo, in ordine alfabetico.
        Un numero non si cancella, si annulla con il motivo.
      </p>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select
          className={`${fieldInputClass} lg:w-36`}
          value={String(year)}
          onChange={(e) => setYear(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))}
          aria-label="Anno"
        >
          <option value="tutti">Tutti gli anni</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <SegmentedControl
          ariaLabel="Consegna"
          value={delivery}
          onChange={setDelivery}
          options={[
            { value: 'tutti', label: 'Tutti' },
            { value: 'da_consegnare', label: 'Da consegnare' },
            { value: 'consegnati', label: 'Consegnati' },
            { value: 'annullati', label: 'Annullati' },
          ]}
        />
        <input
          className={`${fieldInputClass} lg:flex-1`}
          placeholder="Cerca numero, nome, codice fiscale, corso…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-2">
          <SecondaryButton type="button" onClick={() => exportList('excel')} disabled={!shown.length}>
            Excel
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => exportList('pdf')} disabled={!shown.length}>
            PDF
          </SecondaryButton>
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Carico…</p>
      ) : (
        <CertificatesList rows={shown} resetKey={`${year}|${delivery}|${query}`} showCourse onChanged={load} onError={setError} />
      )}
    </div>
  )
}
