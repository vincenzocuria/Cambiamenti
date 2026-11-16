import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SecondaryButton } from '../Buttons'
import { fieldInputClass } from '../Field'
import { ListPagination } from '../ListPagination'
import { usePagedSlice } from '../../hooks/usePagedSlice'
import { fmtDate } from '../../lib/format'
import { courseLabel } from '../../lib/protocol'
import { certificateLabel, type Certificate } from '../../lib/quality'
import { cancelCertificate, markCertificatesDelivered } from '../../services/quality'

const today = () => new Date().toISOString().slice(0, 10)

/** Elenco attestati con selezione, consegna e annullamento: usato nel registro e nella scheda corso. */
export function CertificatesList({
  rows,
  resetKey,
  showCourse,
  onChanged,
  onError,
}: {
  rows: Certificate[]
  resetKey: string
  showCourse: boolean
  onChanged: () => Promise<void> | void
  onError: (msg: string) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deliveredOn, setDeliveredOn] = useState(today)
  const [method, setMethod] = useState('a mano, con firma per ricevuta')
  const [busy, setBusy] = useState(false)
  const { page, setPage, pages, slice, pageSize } = usePagedSlice(rows, resetKey, 25)

  const selectable = rows.filter((c) => !c.cancelled_at)
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id))

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
      await onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  function deliver() {
    if (!method.trim()) return onError('Indica come sono stati consegnati')
    void run(async () => {
      await markCertificatesDelivered([...selected], deliveredOn, method.trim())
      setSelected(new Set())
    })
  }

  function toggleCancel(c: Certificate) {
    let reason: string | null = null
    if (!c.cancelled_at) {
      reason = window.prompt(`Motivo dell'annullamento dell'attestato n. ${certificateLabel(c)}`, '')
      if (reason == null) return
      if (!reason.trim()) return onError("Indica il motivo dell'annullamento")
    }
    void run(() => cancelCertificate(c.id, reason?.trim() ?? null))
  }

  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Nessun attestato.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.id)))}
          />
          Seleziona tutti ({selected.size})
        </label>
        <input type="date" className={`${fieldInputClass} sm:w-40`} value={deliveredOn} onChange={(e) => setDeliveredOn(e.target.value)} aria-label="Data di consegna" />
        <input className={`${fieldInputClass} sm:flex-1`} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Modalità di consegna" />
        <SecondaryButton type="button" disabled={busy || !selected.size} onClick={deliver}>
          Segna consegnati
        </SecondaryButton>
      </div>
      {slice.map((c) => (
        <div key={c.id} className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${c.cancelled_at ? 'opacity-60' : ''}`}>
          <input
            type="checkbox"
            className="mt-1"
            disabled={!!c.cancelled_at}
            checked={selected.has(c.id)}
            onChange={() => toggle(c.id)}
            aria-label={`Seleziona ${certificateLabel(c)}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span className={`font-mono text-sm font-semibold ${c.cancelled_at ? 'line-through' : 'text-slate-900'}`}>{certificateLabel(c)}</span>
              <span className="text-sm text-slate-500">{fmtDate(c.issued_on)}</span>
              <span className="text-sm font-medium text-slate-800">{c.holder_name}</span>
              {c.cancelled_at ? (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Annullato: {c.cancelled_reason}</span>
              ) : c.delivered_on ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Consegnato il {fmtDate(c.delivered_on)}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Da consegnare</span>
              )}
              <button
                type="button"
                className="ml-auto text-xs text-slate-500 underline hover:text-slate-700"
                disabled={busy}
                onClick={() => toggleCancel(c)}
              >
                {c.cancelled_at ? 'Ripristina' : 'Annulla numero'}
              </button>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {[c.title, c.hours != null && `${String(c.hours).replace('.', ',')} ore`, c.outcome, c.holder_tax_code, c.delivery_method, c.notes]
                .filter(Boolean)
                .join(' · ')}
              {showCourse && c.course && (
                <>
                  {' · '}
                  <Link to={`/corsi/${c.course.id}`} className="text-indigo-600 hover:underline">
                    {courseLabel(c.course)}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      ))}
      <ListPagination page={page} pages={pages} pageSize={pageSize} total={rows.length} onPage={setPage} />
    </div>
  )
}
