import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { expiringCompanyDocuments, expiryLabel, type CompanyDocument } from '../lib/companyDocuments'
import { listCompanyDocuments } from '../services/companyDocuments'
import { todayIso } from '../lib/todos'
import { fmtDate } from '../lib/format'

/** Documenti della società scaduti o in scadenza entro 30 giorni. Non compare se non ce ne sono. */
export function DashboardCompanyDocs() {
  const [items, setItems] = useState<CompanyDocument[]>([])
  const today = todayIso()

  useEffect(() => {
    listCompanyDocuments()
      .then((docs) => setItems(expiringCompanyDocuments(docs, todayIso())))
      // senza la tabella (migrazione non ancora applicata) la dashboard resta com'è
      .catch(() => setItems([]))
  }, [])

  if (!items.length) return null

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Documenti della società da rinnovare</h2>
        <Link to="/documenti-societa?vista=scadenze" className="text-xs text-indigo-600 hover:underline">
          Apri i documenti
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((d) => {
          const expired = !!d.expires_on && d.expires_on < today
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-sm">
              <span className="min-w-0 flex-1 font-medium text-slate-800">{d.title}</span>
              {d.expires_on && (
                <span className={'text-xs tabular-nums ' + (expired ? 'font-medium text-red-600' : 'text-amber-700')}>
                  {expiryLabel(d.expires_on, today)} ({fmtDate(d.expires_on)})
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
