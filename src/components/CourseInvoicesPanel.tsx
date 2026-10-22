import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Course, CourseReportLine } from '../types/db'
import {
  courseInvoiceKindLabel,
  courseInvoiceKinds,
  courseInvoiceSummary,
  formatAmountInput,
  parseAmountInput,
  suggestedDebitAmount,
  type CourseInvoiceKind,
} from '../lib/courseInvoice'
import { courseEditionNumber } from '../lib/regionReport'
import { docTypeLabel } from '../lib/fatturaPa'
import { formatEuro } from '../lib/euroInWords'
import { fmtDate } from '../lib/format'
import { listCourses } from '../services/courses'
import { listReportLinesForDocuments } from '../services/courseDocuments'
import { createDebitNote, listCourseInvoices, type CourseInvoiceRow } from '../services/courseInvoices'
import { KpiCards } from './KpiCards'
import { Modal } from './Modal'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { InvoiceStatusPill } from './InvoiceStatusPill'

const money = (n: number | null | undefined) => (n == null ? '—' : `€ ${formatEuro(Number(n))}`)

const debitKinds = courseInvoiceKinds.filter((k) => k.value !== 'other')

/** Note di debito e fatture del corso: quadro con il verbale, storico e creazione della nota. */
export function CourseInvoicesPanel({
  course,
  reportLines,
  rows,
  shownRows = rows,
  onChanged,
}: {
  course: Course
  reportLines: CourseReportLine[]
  rows: CourseInvoiceRow[]
  /** Righe da mostrare in tabella (es. filtrate dalla ricerca); i KPI usano sempre tutte. */
  shownRows?: CourseInvoiceRow[]
  onChanged: () => void
}) {
  const [creating, setCreating] = useState<CourseInvoiceKind | null>(null)
  const summary = useMemo(() => courseInvoiceSummary(rows, reportLines), [rows, reportLines])
  const hasReport = reportLines.length > 0

  const kpis = [
    {
      key: 'riconosciuto',
      label: 'Riconosciuto',
      value: hasReport ? money(summary.recognized) : '—',
      hint: hasReport ? `Saldo da verbale ${money(summary.balanceDue)}` : 'Nessun verbale caricato',
    },
    {
      key: 'fatturato',
      label: 'Fatturato',
      value: money(summary.billed),
      hint: [
        summary.billedBalance ? `saldo ${money(summary.billedBalance)}` : '',
        summary.billedAllowance ? `indennità ${money(summary.billedAllowance)}` : '',
        summary.drafts ? `${summary.drafts} in bozza` : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'Nessuna nota emessa',
    },
    {
      key: 'incassato',
      label: 'Incassato',
      value: money(summary.paid),
      hint: summary.billed ? `Da incassare ${money(Math.max(0, summary.billed - summary.paid))}` : undefined,
      tone: summary.billed && summary.paid >= summary.billed ? ('ok' as const) : ('default' as const),
    },
    {
      key: 'dafatturare',
      label: 'Saldo da fatturare',
      value: hasReport ? money(summary.toBill) : '—',
      hint: hasReport ? 'Saldo del verbale meno le note di saldo' : 'Serve il verbale della Regione',
      tone: hasReport && summary.toBill > 0 ? ('warn' as const) : ('ok' as const),
    },
  ]

  return (
    <div className="space-y-4">
      <KpiCards items={kpis} compact className="" />

      <div className="flex flex-wrap gap-2">
        {debitKinds.map((k) => (
          <SecondaryButton key={k.value} onClick={() => setCreating(k.value)}>
            + Nota di debito: {k.label.toLowerCase()}
          </SecondaryButton>
        ))}
      </div>

      {shownRows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          Nessuna fattura collegata. Le note importate da Aruba si collegano da sole quando una riga riporta
          «ID CORSO: {course.code || '…'}, ED. {courseEditionNumber(course.edition) ?? '…'}».
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Numero</th>
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Voce</th>
                <th className="py-2 pr-3 text-right font-medium">Importo corso</th>
                <th className="py-2 pr-3 font-medium">Stato</th>
                <th className="py-2 font-medium">Incasso</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map((r) => (
                <tr key={`${r.invoice_id}-${r.line_index}`} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <Link to={`/fatturazione/${r.invoice_id}`} className="font-medium text-indigo-600 hover:underline">
                      {r.invoice.number || '(bozza)'}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {docTypeLabel(r.invoice.doc_type)} · {r.invoice.counterpart_name || '—'}
                    </div>
                  </td>
                  <td className="py-2 pr-3">{fmtDate(r.invoice.invoice_date)}</td>
                  <td className="py-2 pr-3">{courseInvoiceKindLabel(r.kind)}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {money(r.invoice.doc_type === 'TD04' && r.amount ? -r.amount : r.amount)}
                  </td>
                  <td className="py-2 pr-3">
                    {r.invoice.status === 'draft' ? (
                      <span className="text-xs text-amber-700">Bozza</span>
                    ) : (
                      <InvoiceStatusPill invoice={r.invoice} />
                    )}
                  </td>
                  <td className="py-2">
                    {r.invoice.paid_at ? (
                      <span className="text-emerald-700">{fmtDate(r.invoice.paid_at)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <DebitNoteModal
          course={course}
          reportLines={reportLines}
          initialKind={creating}
          onClose={() => setCreating(null)}
          onCreated={onChanged}
        />
      )}
    </div>
  )
}

interface Candidate {
  course: Course
  report: CourseReportLine | null
  billed: boolean
}

/** Sceglie i corsi (questo e gli altri dello stesso verbale o CUP) e gli importi, poi crea la bozza. */
function DebitNoteModal({
  course,
  reportLines,
  initialKind,
  onClose,
  onCreated,
}: {
  course: Course
  reportLines: CourseReportLine[]
  initialKind: CourseInvoiceKind
  onClose: () => void
  onCreated: () => void
}) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<CourseInvoiceKind>(initialKind)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const docIds = [...new Set(reportLines.map((l) => l.document_id))]
      const [all, lines] = await Promise.all([listCourses(), listReportLinesForDocuments(docIds)])
      const latest = new Map<string, CourseReportLine>()
      for (const l of [...lines, ...reportLines].sort((a, b) =>
        (a.protocol_date ?? '').localeCompare(b.protocol_date ?? ''),
      ))
        latest.set(l.course_id, l)
      const related = all.filter(
        (c) => c.id === course.id || latest.has(c.id) || (!!course.cup && c.cup === course.cup),
      )
      const invoices = await listCourseInvoices(related.map((c) => c.id))
      const list = related
        .map((c) => ({
          course: c,
          report: latest.get(c.id) ?? null,
          billed: invoices.some((r) => r.course_id === c.id && r.kind === kind),
        }))
        .sort((a, b) =>
          a.course.id === course.id ? -1 : b.course.id === course.id ? 1 : a.course.code.localeCompare(b.course.code) || a.course.edition.localeCompare(b.course.edition),
        )
      if (cancelled) return
      setCandidates(list)
      // Questo corso, più quelli dello stesso verbale non ancora fatturati per questa voce
      setSelected(
        Object.fromEntries(
          list.map((c) => [c.course.id, c.course.id === course.id || (!c.billed && !!c.report && reportLines.some((l) => l.document_id === c.report!.document_id))]),
        ),
      )
      setAmounts(
        Object.fromEntries(list.map((c) => [c.course.id, formatAmountInput(suggestedDebitAmount(kind, c.report))])),
      )
    }
    load().catch((err) => setError(err instanceof Error ? err.message : 'Corsi non caricati'))
    return () => {
      cancelled = true
    }
  }, [course, reportLines, kind])

  const parse = parseAmountInput
  const chosen = (candidates ?? []).filter((c) => selected[c.course.id])
  const total = chosen.reduce((n, c) => n + parse(amounts[c.course.id] ?? ''), 0)

  async function handleCreate() {
    setBusy(true)
    setError('')
    try {
      const id = await createDebitNote(
        kind,
        chosen.map((c) => ({ course: c.course, report: c.report, amount: parse(amounts[c.course.id] ?? '') })),
      )
      onCreated()
      navigate(`/fatturazione/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nota non creata')
      setBusy(false)
    }
  }

  return (
    <Modal title="Nuova nota di debito alla Regione" onClose={onClose}>
      <div className="space-y-4 overflow-y-auto">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Voce</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CourseInvoiceKind)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm"
          >
            {debitKinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        {candidates == null ? (
          <p className="text-sm text-slate-400">Caricamento corsi…</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Una riga per corso. Sono proposti questo corso e gli altri dello stesso verbale non ancora fatturati
              per questa voce; il saldo viene dal verbale, gli altri importi scrivili tu.
            </p>
            {candidates.map((c) => (
              <div key={c.course.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!selected[c.course.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [c.course.id]: e.target.checked }))}
                  aria-label={`Includi ${c.course.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">
                    {c.course.name} · {c.course.code} ED. {courseEditionNumber(c.course.edition) ?? '?'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {c.report ? `Verbale: saldo ${money(c.report.amount_balance)}` : 'Nessun verbale'}
                    {c.billed ? ' · già fatturato per questa voce' : ''}
                  </div>
                </div>
                <input
                  inputMode="decimal"
                  className="h-9 w-32 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums"
                  value={amounts[c.course.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [c.course.id]: e.target.value }))}
                  aria-label={`Importo per ${c.course.name}`}
                  placeholder="0,00"
                />
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-slate-700">
          Totale nota: <span className="font-semibold">{money(total)}</span> · esente art. 10, intestata alla
          Regione, numero nella serie FPA. La apro in Fatturazione come bozza: controlla il testo, poi scarica
          l'XML o caricala su Aruba.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Annulla</SecondaryButton>
          <PrimaryButton disabled={busy || !chosen.length} onClick={() => void handleCreate()}>
            {busy ? 'Creazione…' : 'Crea bozza'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  )
}
