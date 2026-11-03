import { useCallback, useEffect, useState } from 'react'
import { ProposalCard } from '../components/ProposalCard'
import type { ProposalStatus } from '../lib/proposals'
import { fetchProposals, type ProposalWithRefs } from '../services/proposals'

type Filter = ProposalStatus | 'tutte'

const filters: { value: Filter; label: string }[] = [
  { value: 'proposta', label: 'Da decidere' },
  { value: 'applicata', label: 'Accettate' },
  { value: 'rifiutata', label: 'Rifiutate' },
  { value: 'errore', label: 'Non riuscite' },
  { value: 'tutte', label: 'Tutte' },
]

/** Modifiche proposte dalle PEC e dai documenti: si applicano solo se accettate. */
export function ProposalsPage() {
  const [filter, setFilter] = useState<Filter>('proposta')
  const [rows, setRows] = useState<ProposalWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetchProposals(filter)
      .then((r) => {
        setRows(r)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore caricamento proposte'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(load, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Proposte</h1>
        <p className="mt-1 text-sm text-slate-500">
          Modifiche trovate leggendo PEC e documenti. Il gestionale cambia solo quando premi «Accetta».
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={f.value === filter}
            onClick={() => setFilter(f.value)}
            className={
              'rounded-full border px-3 py-1.5 text-sm font-medium ' +
              (f.value === filter ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800" role="status">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Caricamento…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-slate-500">Nessuna proposta in questo elenco.</p>}

      <ul className="space-y-3">
        {rows.map((p) => (
          <ProposalCard
            key={p.id}
            p={p}
            onDone={(message) => {
              setNotice(message)
              load()
            }}
          />
        ))}
      </ul>
    </div>
  )
}
