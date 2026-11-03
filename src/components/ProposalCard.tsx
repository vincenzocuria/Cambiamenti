import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { formatCourseEdition } from '../lib/format'
import { proposalAction, proposalDiff, proposalKindLabel, type ProposalStatus } from '../lib/proposals'
import { acceptProposal, rejectProposal, type ProposalWithRefs } from '../services/proposals'

const statusBadge: Record<ProposalStatus, { label: string; className: string }> = {
  proposta: { label: 'Da decidere', className: 'bg-amber-50 text-amber-900' },
  applicata: { label: 'Accettata', className: 'bg-emerald-50 text-emerald-800' },
  rifiutata: { label: 'Rifiutata', className: 'bg-slate-100 text-slate-600' },
  errore: { label: 'Non riuscita', className: 'bg-red-50 text-red-700' },
}

function fmtDay(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('it-IT') : '—'
}

/** Una proposta: cosa cambia, perché, e i tasti Accetta / Rifiuta. inMail = mostrata dentro una PEC. */
export function ProposalCard({ p, onDone, inMail = false }: { p: ProposalWithRefs; onDone: (message: string) => void; inMail?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const rows = proposalDiff(p)
  const hasBefore = rows.some((r) => r.before !== '')
  const badge = statusBadge[p.status]
  const pending = p.status === 'proposta' || p.status === 'errore'

  async function accept() {
    setBusy(true)
    const res = await acceptProposal(p)
    setBusy(false)
    onDone(res.ok ? `Fatto: ${res.message}` : `Non riuscita: ${res.message}`)
  }

  async function reject() {
    setBusy(true)
    try {
      await rejectProposal(p.id, reason)
      onDone('Proposta rifiutata')
    } catch (err) {
      onDone(err instanceof Error ? err.message : 'Rifiuto non riuscito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={inMail ? 'rounded-lg border border-indigo-100 bg-indigo-50/40 p-3' : 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{proposalKindLabel[p.kind]}</p>
          <h2 className="mt-0.5 font-semibold text-slate-900">{p.title}</h2>
          {p.course && (
            <Link to={`/corsi/${p.course.id}`} className="mt-1 inline-block text-sm text-indigo-700 hover:underline">
              {p.course.name}
              {formatCourseEdition(p.course.edition) ? ` · ${formatCourseEdition(p.course.edition)}` : ''}
            </Link>
          )}
        </div>
        <span className={'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ' + badge.className}>{badge.label}</span>
      </div>

      {pending && (
        <p className="mt-2 text-sm font-medium text-indigo-900">{proposalAction(p, p.course?.name)}</p>
      )}

      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[18rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 pr-3 font-medium">Campo</th>
                {hasBefore && <th className="py-1 pr-3 font-medium">Ora</th>}
                <th className="py-1 font-medium">Proposto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-3 text-slate-600">{r.label}</td>
                  {hasBefore && <td className="py-1.5 pr-3 text-slate-500 line-through decoration-slate-300">{r.before}</td>}
                  <td className="whitespace-pre-wrap break-words py-1.5 font-medium text-slate-900 [overflow-wrap:anywhere]">{r.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.reason && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">Perché: </span>
          {p.reason}
        </p>
      )}
      {p.pec && !inMail && (
        <p className="mt-2 text-xs text-slate-500">
          Fonte: PEC del {fmtDay(p.pec.sent_at)} da {p.pec.from_address} — «{p.pec.subject}» ·{' '}
          <Link to="/posta" className="text-indigo-700 hover:underline">
            apri la posta
          </Link>
        </p>
      )}
      {p.result && p.status !== 'proposta' && (
        <p className={'mt-2 text-sm ' + (p.status === 'errore' ? 'text-red-700' : 'text-slate-600')}>
          {p.status === 'rifiutata' ? 'Motivo: ' : 'Esito: '}
          {p.result}
        </p>
      )}

      {pending && !rejecting && (
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton onClick={accept} disabled={busy}>
            {p.status === 'errore' ? 'Riprova' : 'Accetta'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setRejecting(true)} disabled={busy}>
            Rifiuta
          </SecondaryButton>
        </div>
      )}
      {pending && rejecting && (
        <div className="mt-3 space-y-2">
          <label className="block text-sm text-slate-600" htmlFor={`reason-${p.id}`}>
            Motivo (facoltativo)
          </label>
          <input
            id={`reason-${p.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Es. dato sbagliato, corso già presente…"
          />
          <div className="flex gap-2">
            <PrimaryButton onClick={reject} disabled={busy}>
              Conferma rifiuto
            </PrimaryButton>
            <SecondaryButton onClick={() => setRejecting(false)} disabled={busy}>
              Annulla
            </SecondaryButton>
          </div>
        </div>
      )}
    </li>
  )
}
