import { useEffect, useState } from 'react'
import type { CourseReportLine } from '../types/db'
import { listCourseReportLines } from '../services/courseDocuments'
import { formatEuro } from '../lib/euroInWords'
import { fmtDate } from '../lib/format'

const money = (n: number | null) => (n == null ? '—' : `€ ${formatEuro(Number(n))}`)

/** Importi del corso letti dai verbali della Regione (si vede solo se ce ne sono). */
export function CourseReportLines({ courseId }: { courseId: string }) {
  const [lines, setLines] = useState<CourseReportLine[]>([])

  useEffect(() => {
    listCourseReportLines(courseId)
      .then(setLines)
      .catch(() => setLines([]))
  }, [courseId])

  if (lines.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Verbali della Regione</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Verbale</th>
              <th className="py-2 pr-3 text-right font-medium">Allievi formati</th>
              <th className="py-2 pr-3 text-right font-medium">Preventivo</th>
              <th className="py-2 pr-3 text-right font-medium">Riconosciuto</th>
              <th className="py-2 pr-3 text-right font-medium">Anticipazione</th>
              <th className="py-2 text-right font-medium">Saldo da liquidare</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3">
                  <div className="font-medium text-slate-800">{l.subject || 'Verbale'}</div>
                  <div className="text-xs text-slate-500">
                    {l.protocol_number ? `Prot. ${l.protocol_number} del ${fmtDate(l.protocol_date)}` : ''}
                    {l.membership_act ? ` · Atto ${l.membership_act}` : ''}
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{l.students_trained ?? '—'}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(l.amount_budget)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(l.amount_recognized)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(l.amount_advance)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{money(l.amount_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
