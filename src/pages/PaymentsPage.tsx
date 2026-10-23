import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KpiCards } from '../components/KpiCards'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { DangerButton, SecondaryButton } from '../components/Buttons'
import { PaymentForm, type PaymentFormTarget } from '../components/PaymentForm'
import { MigrationNotice } from '../components/DashboardPayments'
import { fmtDate, formatCourseEdition } from '../lib/format'
import { euro as money, paymentsTotals, type CoursePaymentSummary } from '../lib/paymentsSummary'
import { deleteCoursePayment, fetchPaymentsData, type PaymentsData } from '../services/payments'
import { staffRoleSingular } from '../data/personTypes'
import type { CoursePayment } from '../types/db'

const kindLabel: Record<CoursePayment['kind'], string> = {
  anticipo: 'Anticipo',
  saldo: 'Saldo',
  compenso: 'Compenso',
  altro: 'Altro',
}

function courseLabel(row: CoursePaymentSummary): string {
  const ed = formatCourseEdition(row.course.edition)
  return ed ? `${row.course.name} · ${ed}` : row.course.name
}

function hasMoney(row: CoursePaymentSummary): boolean {
  return (
    row.report != null ||
    row.staffPlanned > 0 ||
    row.payments.length > 0 ||
    row.received !== 0 ||
    row.allowanceToReceive > 0
  )
}

/** Saldi della Regione da ricevere e compensi del personale da erogare, corso per corso. */
export function PaymentsPage() {
  const [data, setData] = useState<PaymentsData | null>(null)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [target, setTarget] = useState<PaymentFormTarget | null>(null)

  const load = useCallback(() => {
    fetchPaymentsData()
      .then((next) => {
        setData(next)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore caricamento pagamenti'))
  }, [])

  useEffect(load, [load])

  async function handleDelete(p: CoursePayment) {
    if (!window.confirm(`Eliminare il movimento di ${money(Number(p.amount))}?`)) return
    try {
      await deleteCoursePayment(p.id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita')
    }
  }

  const rows = data?.rows ?? []
  const totals = paymentsTotals(rows)
  const visible = showAll ? rows : rows.filter(hasMoney)
  const canWrite = data?.paymentsEnabled ?? false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pagamenti</h1>
        <p className="mt-1 text-sm text-slate-500">
          Saldi della Regione (dai verbali) da incassare e compensi del personale da erogare.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && !data.paymentsEnabled && <MigrationNotice />}

      <KpiCards
        className=""
        items={[
          {
            key: 'saldi',
            label: 'Saldi Regione',
            value: data ? money(totals.balance) : '…',
            hint: `${totals.coursesWithReport} corsi con verbale`,
          },
          {
            key: 'ricevere',
            label: 'Da ricevere',
            value: data ? money(totals.toReceive) : '…',
            hint: `Incassati ${money(totals.received)}`,
            tone: totals.toReceive > 0 ? 'warn' : 'ok',
          },
          {
            key: 'erogati',
            label: 'Erogati',
            value: data ? money(totals.staffPaid) : '…',
            hint: 'Compensi pagati al personale',
            tone: 'ok',
          },
          {
            key: 'erogare',
            label: 'Da erogare',
            value: data ? money(totals.staffToPay) : '…',
            hint:
              totals.staffMissingRate > 0
                ? `${totals.staffMissingRate} incarichi senza ore o tariffa`
                : `Su ${money(totals.staffPlanned)} previsti`,
            tone: totals.staffToPay > 0 || totals.staffMissingRate > 0 ? 'warn' : 'ok',
          },
        ]}
      />

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Mostra anche i corsi senza verbale né compensi
      </label>

      {data && visible.length === 0 && (
        <p className="text-sm text-slate-500">
          Nessun corso con importi. Carica un verbale della Regione o imposta ore e compenso orario
          del personale nella scheda corso.
        </p>
      )}

      {visible.map((row) => (
        <section
          key={row.course.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              to={`/corsi/${row.course.id}`}
              className="text-base font-semibold text-indigo-700 hover:underline"
            >
              {courseLabel(row)}
            </Link>
            <CourseStatusBadge status={row.course.status} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Regione</h3>
                {canWrite && (
                  <SecondaryButton
                    size="sm"
                    onClick={() =>
                      setTarget({
                        courseId: row.course.id,
                        courseLabel: courseLabel(row),
                        direction: 'in',
                        // Solo il saldo: le indennità passano dalle note di debito
                        suggested: row.balanceToReceive,
                      })
                    }
                  >
                    Registra incasso
                  </SecondaryButton>
                )}
              </div>
              {row.report ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <Amount label="Riconosciuto" value={row.recognized} />
                  <Amount label="Anticipo (verbale)" value={row.advance} />
                  <Amount label="Saldo da liquidare" value={row.balance} />
                  <Amount label="Incassato" value={row.received} />
                  {row.allowanceToReceive > 0 && (
                    <Amount label="Indennità fatturate da incassare" value={row.allowanceToReceive} />
                  )}
                  <Amount label="Da ricevere" value={row.toReceive} strong warn={row.toReceive > 0} />
                </dl>
              ) : (
                <p className="text-sm text-slate-500">
                  Nessun verbale caricato.
                  {row.received !== 0 ? ` Incassato ${money(row.received)}.` : ''}
                  {row.allowanceToReceive > 0
                    ? ` Indennità fatturate da incassare ${money(row.allowanceToReceive)}.`
                    : ''}
                </p>
              )}
              {row.receivedFromInvoices !== 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Di cui {money(row.receivedFromInvoices)} da note di debito incassate (Aruba).
                </p>
              )}
              {row.report && (
                <p className="mt-2 text-xs text-slate-400">
                  Verbale {row.report.protocol_number ? `Prot. ${row.report.protocol_number} ` : ''}
                  del {fmtDate(row.report.protocol_date)}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Personale</h3>
              {row.staff.length === 0 ? (
                <p className="text-sm text-slate-500">Nessuna figura assegnata.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="py-1 pr-2 font-medium">Figura</th>
                        <th className="py-1 pr-2 text-right font-medium">Previsto</th>
                        <th className="py-1 pr-2 text-right font-medium">Erogato</th>
                        <th className="py-1 pr-2 text-right font-medium">Da erogare</th>
                        <th className="py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {row.staff.map((s) => (
                        <tr key={`${s.personId}-${s.role}`} className="border-t border-slate-200">
                          <td className="py-1.5 pr-2">
                            <Link
                              to={`/personale/${s.personId}`}
                              className="font-medium text-slate-800 hover:underline"
                            >
                              {s.name}
                            </Link>
                            <div className="text-xs text-slate-500">
                              {staffRoleSingular(s.role)}
                              {s.hours != null && s.hourlyRate != null
                                ? ` · ${String(s.hours).replace('.', ',')} h × ${money(s.hourlyRate)}`
                                : ''}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">
                            {s.planned != null ? (
                              money(s.planned)
                            ) : (
                              <span className="text-xs text-amber-700">ore/tariffa mancanti</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{money(s.paid)}</td>
                          <td
                            className={
                              'py-1.5 pr-2 text-right font-semibold tabular-nums ' +
                              (s.toPay > 0 ? 'text-amber-800' : 'text-emerald-700')
                            }
                          >
                            {money(s.toPay)}
                          </td>
                          <td className="py-1.5 text-right">
                            {canWrite && (
                              <SecondaryButton
                                size="sm"
                                onClick={() =>
                                  setTarget({
                                    courseId: row.course.id,
                                    courseLabel: courseLabel(row),
                                    direction: 'out',
                                    personId: s.personId,
                                    personName: s.name,
                                    role: s.role,
                                    suggested: s.toPay,
                                  })
                                }
                              >
                                Paga
                              </SecondaryButton>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {row.staffMissingRate > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Ore e compenso orario si impostano nella{' '}
                  <Link to={`/corsi/${row.course.id}`} className="text-indigo-600 hover:underline">
                    scheda corso
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>

          {row.payments.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Movimenti
              </h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {row.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                    <span className="w-24 text-slate-500">{fmtDate(p.paid_on)}</span>
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                        (p.direction === 'in'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-indigo-50 text-indigo-700')
                      }
                    >
                      {p.direction === 'in' ? 'Incasso' : 'Erogato'} · {kindLabel[p.kind]}
                    </span>
                    <span className="min-w-0 flex-1 text-slate-600">
                      {staffName(row, p)}
                      {p.reference ? ` · ${p.reference}` : ''}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </span>
                    <span className="font-medium tabular-nums text-slate-800">
                      {money(Number(p.amount))}
                    </span>
                    <DangerButton onClick={() => handleDelete(p)}>Elimina</DangerButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      {target && (
        <PaymentForm
          target={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function staffName(row: CoursePaymentSummary, p: CoursePayment): string {
  if (p.direction === 'in') return 'Regione'
  return row.staff.find((s) => s.personId === p.person_id)?.name ?? 'Personale'
}

function Amount({
  label,
  value,
  strong = false,
  warn = false,
}: {
  label: string
  value: number
  strong?: boolean
  warn?: boolean
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={
          'text-right tabular-nums ' +
          (strong ? 'font-semibold ' : 'text-slate-800 ') +
          (strong ? (warn ? 'text-amber-800' : 'text-emerald-700') : '')
        }
      >
        {money(value)}
      </dd>
    </>
  )
}
