import { Link } from 'react-router-dom'
import { KpiCards } from './KpiCards'
import { formatCourseEdition } from '../lib/format'
import { euro, paymentsTotals } from '../lib/paymentsSummary'
import type { PaymentsData } from '../services/payments'

/** KPI economici in dashboard: saldi Regione, da ricevere, erogati, da erogare. */
export function DashboardPayments({ data }: { data: PaymentsData | null }) {
  const rows = data?.rows ?? []
  const t = paymentsTotals(rows)
  const loading = data == null
  const v = (n: number) => (loading ? '…' : euro(n))

  const open = rows
    .filter((r) => r.toReceive > 0 || r.staffToPay > 0 || r.staffMissingRate > 0)
    .sort((a, b) => b.toReceive + b.staffToPay - (a.toReceive + a.staffToPay))

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Pagamenti</h2>
          <p className="text-xs text-slate-500">
            Saldi dai verbali della Regione e compensi del personale (ore × tariffa).
          </p>
        </div>
        <Link to="/pagamenti" className="text-sm font-medium text-indigo-600 hover:underline">
          Gestisci pagamenti →
        </Link>
      </div>

      {data && !data.paymentsEnabled && <MigrationNotice />}

      <KpiCards
        className=""
        items={[
          {
            key: 'saldi',
            label: 'Saldi Regione',
            value: v(t.balance),
            hint: `Riconosciuto ${euro(t.recognized)} · ${t.coursesWithReport} corsi`,
            to: '/pagamenti',
          },
          {
            key: 'ricevere',
            label: 'Da ricevere',
            value: v(t.toReceive),
            hint:
              t.coursesToReceive > 0
                ? `${t.coursesToReceive} corsi in attesa · incassati ${euro(t.received)}`
                : `Incassati ${euro(t.received)}`,
            to: '/pagamenti',
            tone: t.toReceive > 0 ? 'warn' : 'ok',
          },
          {
            key: 'erogati',
            label: 'Erogati',
            value: v(t.staffPaid),
            hint: 'Compensi pagati al personale',
            to: '/pagamenti',
            tone: 'ok',
          },
          {
            key: 'erogare',
            label: 'Da erogare',
            value: v(t.staffToPay),
            hint:
              t.staffMissingRate > 0
                ? `${t.staffMissingRate} incarichi senza ore o tariffa`
                : `Su ${euro(t.staffPlanned)} previsti`,
            to: '/pagamenti',
            tone: t.staffToPay > 0 || t.staffMissingRate > 0 ? 'warn' : 'ok',
          },
        ]}
      />

      {open.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Aperti per corso</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Corso</th>
                  <th className="py-2 pr-3 text-right font-medium">Saldo Regione</th>
                  <th className="py-2 pr-3 text-right font-medium">Da ricevere</th>
                  <th className="py-2 pr-3 text-right font-medium">Erogati</th>
                  <th className="py-2 text-right font-medium">Da erogare</th>
                </tr>
              </thead>
              <tbody>
                {open.slice(0, 10).map((r) => {
                  const ed = formatCourseEdition(r.course.edition)
                  return (
                    <tr key={r.course.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <Link
                          to={`/corsi/${r.course.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {r.course.name}
                          {ed ? ` · ${ed}` : ''}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.report ? euro(r.balance) : '—'}
                      </td>
                      <td
                        className={
                          'py-2 pr-3 text-right font-semibold tabular-nums ' +
                          (r.toReceive > 0 ? 'text-amber-800' : 'text-slate-400')
                        }
                      >
                        {euro(r.toReceive)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{euro(r.staffPaid)}</td>
                      <td
                        className={
                          'py-2 text-right font-semibold tabular-nums ' +
                          (r.staffToPay > 0 ? 'text-amber-800' : 'text-slate-400')
                        }
                      >
                        {euro(r.staffToPay)}
                        {r.staffMissingRate > 0 && (
                          <span className="block text-xs font-normal text-slate-400">
                            {r.staffMissingRate} senza tariffa
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {open.length > 10 && (
            <p className="mt-3 text-xs text-slate-400">+ altri {open.length - 10} corsi</p>
          )}
        </div>
      )}
    </section>
  )
}

export function MigrationNotice() {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Per registrare incassi e compensi va applicata la migrazione 0025 (tabella dei pagamenti).
      Intanto si vedono i saldi dei verbali e i compensi previsti.
    </p>
  )
}
