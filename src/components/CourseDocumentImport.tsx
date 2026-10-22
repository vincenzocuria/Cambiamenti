import { useEffect, useMemo, useState } from 'react'
import type { Course, DocumentCategory } from '../types/db'
import { listCourses } from '../services/courses'
import { uploadDocument } from '../services/documents'
import { linkDocumentToCourses, saveReportLines } from '../services/courseDocuments'
import { isSignedFileName, p7mSigners, unwrapP7m } from '../lib/p7m'
import { pdfLines } from '../lib/pdfText'
import {
  coursesWithCups,
  dateMismatches,
  matchReportRow,
  parseRegionReport,
  suggestedTitle,
  type ParsedReport,
} from '../lib/regionReport'
import { formatEuro } from '../lib/euroInWords'
import { DOCUMENT_FILE_ACCEPT, formatDocumentUploadError } from '../lib/documentFileTypes'
import { categoryLabels } from '../data/documentCategories'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { fieldInputClass, SelectField, TextField } from './Field'
import { IdCheckboxList } from './IdCheckboxList'
import { Modal } from './Modal'

interface Props {
  /** Corso da cui si apre l'import (proposto tra i corsi collegati). */
  currentCourseId?: string
  onClose: () => void
  onSaved: () => void
}

const money = (n: number | null) => (n == null ? '—' : `€ ${formatEuro(n)}`)
const courseLabel = (c: Course) =>
  [c.code, c.name, c.edition].filter(Boolean).join(' · ') || c.name

const IMPORT_CATEGORIES: DocumentCategory[] = ['report', 'declaration', 'module', 'other']

/**
 * Caricamento di un documento che vale per uno o più corsi (verbali della Regione,
 * autodichiarazioni). Legge il PDF (anche firmato .p7m), propone i corsi e segnala
 * quello che non trova.
 */
export function CourseDocumentImport({ currentCourseId, onClose, onSaved }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [reading, setReading] = useState(false)
  const [report, setReport] = useState<ParsedReport | null>(null)
  const [notices, setNotices] = useState<string[]>([])
  const [signers, setSigners] = useState<string[]>([])
  const [rowCourse, setRowCourse] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState<DocumentCategory>('other')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listCourses().then(setCourses)
  }, [])

  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  async function analyze(f: File) {
    setFile(f)
    setReading(true)
    setReport(null)
    setNotices([])
    setSigners([])
    setRowCourse([])
    setError('')
    const found: string[] = []
    try {
      const all = courses.length ? courses : await listCourses()
      if (!courses.length) setCourses(all)
      const bytes = new Uint8Array(await f.arrayBuffer())
      let content: Uint8Array | null = bytes
      if (isSignedFileName(f.name)) {
        content = unwrapP7m(bytes)
        setSigners(p7mSigners(bytes))
        if (!content) found.push('Il file firmato non si apre: lo carico così com\'è, scegli tu i corsi.')
      }
      const isPdf = content && new TextDecoder('latin1').decode(content.slice(0, 5)) === '%PDF-'
      let parsed: ParsedReport | null = null
      if (content && isPdf) {
        const lines = await pdfLines(content)
        if (lines.length === 0) {
          found.push('Il PDF non contiene testo (forse è una scansione): scegli tu i corsi.')
        } else {
          parsed = parseRegionReport(lines)
        }
      } else if (content) {
        found.push('Non è un PDF: non posso leggerlo, scegli tu i corsi.')
      }

      const preselect = new Set<string>()
      if (parsed) {
        const matches = parsed.rows.map((row) => matchReportRow(row, all))
        parsed.rows.forEach((row, i) => {
          if (!matches[i])
            found.push(
              `Nel gestionale non trovo il corso ${row.courseCode} «${row.title}» ED. ${row.edition ?? '?'} (CUP ${row.cup}): sceglilo a mano.`,
            )
        })
        setRowCourse(matches.map((c) => c?.id ?? ''))
        if (parsed.kind !== 'report') {
          for (const c of coursesWithCups(parsed.cups, all)) preselect.add(c.id)
          if (parsed.cups.length === 0) found.push('Nel documento non trovo nessun CUP: scegli tu i corsi.')
          else if (preselect.size === 0)
            found.push(`Nessun corso del gestionale ha il CUP ${parsed.cups.join(', ')}.`)
        }
        if (parsed.kind === 'report' && !parsed.protocolNumber)
          found.push('Non trovo il numero di protocollo del verbale.')
        if (parsed.kind === 'other')
          found.push('Non riconosco il tipo di documento: controlla categoria e titolo.')
        setCategory(parsed.kind === 'other' ? 'other' : parsed.kind)
        setTitle(suggestedTitle(parsed, f.name))
      } else {
        setTitle(f.name.replace(/(\.p7m|\.m7m)+$/i, ''))
      }
      if (currentCourseId && parsed?.kind !== 'report') preselect.add(currentCourseId)
      setSelected(preselect)
      setReport(parsed)
      setNotices(found)
    } catch (err) {
      setError(err instanceof Error ? `Lettura non riuscita: ${err.message}` : 'Lettura non riuscita')
    } finally {
      setReading(false)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rowCourseIds = rowCourse.filter(Boolean)
  const allCourseIds = [...new Set([...rowCourseIds, ...selected])]
  const duplicateRows = rowCourseIds.length !== new Set(rowCourseIds).size

  async function handleSave() {
    if (!file) return
    if (allCourseIds.length === 0) {
      setError('Scegli almeno un corso a cui collegare il documento.')
      return
    }
    if (duplicateRows) {
      setError('Due righe del verbale puntano allo stesso corso: correggi la scelta.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const primary =
        currentCourseId && allCourseIds.includes(currentCourseId) ? currentCourseId : allCourseIds[0]
      const doc = await uploadDocument({ courseId: primary, category, title, file })
      await linkDocumentToCourses(
        doc.id,
        allCourseIds.filter((id) => id !== primary),
      )
      if (report?.kind === 'report') {
        await saveReportLines(
          report.rows.flatMap((row, i) =>
            rowCourse[i]
              ? [
                  {
                    document_id: doc.id,
                    course_id: rowCourse[i],
                    subject: report.subject,
                    protocol_number: report.protocolNumber,
                    protocol_date: report.protocolDate,
                    report_course_code: row.courseCode,
                    report_edition: row.edition != null ? `ED. ${row.edition}` : '',
                    membership_act: row.membershipAct,
                    students_trained: row.studentsTrained,
                    start_date: row.startDate,
                    end_date: row.endDate,
                    amount_budget: row.budget ?? row.funding,
                    amount_recognized: row.recognized,
                    amount_advance: row.advance,
                    amount_balance: row.balance,
                  },
                ]
              : [],
          ),
        )
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : formatDocumentUploadError(err, file.name),
      )
    } finally {
      setBusy(false)
    }
  }

  const otherCourses = courses
    .filter((c) => report?.kind !== 'report' || !rowCourseIds.includes(c.id))
    .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)))
    .map((c) => ({ id: c.id, label: courseLabel(c), hint: c.cup || undefined }))

  return (
    <Modal title="Carica verbale o documento per più corsi" onClose={onClose} wide>
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
        <p className="text-sm text-slate-500">
          Scegli il file (PDF o firmato .p7m). Il gestionale legge il testo, riconosce verbali e
          autodichiarazioni, propone i corsi tramite CUP, ID corso ed edizione e ti avvisa di quello
          che non trova.
        </p>
        <input
          type="file"
          accept={DOCUMENT_FILE_ACCEPT}
          disabled={reading || busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void analyze(f)
          }}
          className="block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
        />

        {reading && <p className="text-sm text-slate-400">Lettura del documento…</p>}

        {file && !reading && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {report ? categoryLabels[report.kind === 'other' ? 'other' : report.kind] : 'Non letto'}
              </span>
              {report?.protocolNumber && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  Prot. {report.protocolNumber}
                  {report.protocolDate ? ` del ${report.protocolDate.split('-').reverse().join('/')}` : ''}
                </span>
              )}
              {report && report.cups.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  CUP {report.cups.join(', ')}
                </span>
              )}
              {signers.length > 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
                  Firmato da {signers.join(', ')}
                </span>
              )}
            </div>

            {(notices.length > 0 || (report?.warnings.length ?? 0) > 0) && (
              <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {[...notices, ...(report?.warnings ?? [])].map((n) => (
                  <li key={n}>⚠ {n}</li>
                ))}
              </ul>
            )}

            {report?.kind === 'report' && report.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">Nel verbale</th>
                      <th className="py-2 pr-3 font-medium">Corso nel gestionale</th>
                      <th className="py-2 pr-3 text-right font-medium">Allievi</th>
                      <th className="py-2 pr-3 text-right font-medium">Riconosciuto</th>
                      <th className="py-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, i) => {
                      const course = byId.get(rowCourse[i])
                      const diffs = course ? dateMismatches(row, course) : []
                      return (
                        <tr key={i} className="border-b border-slate-100 align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-slate-800">
                              {row.courseCode} · {row.title}
                            </div>
                            <div className="text-xs text-slate-500">
                              ED. {row.edition ?? '?'}
                              {row.membershipAct ? ` · Atto ${row.membershipAct}` : ''}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              className={fieldInputClass}
                              value={rowCourse[i] ?? ''}
                              onChange={(e) =>
                                setRowCourse((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                              }
                            >
                              <option value="">— non collegare —</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {courseLabel(c)}
                                </option>
                              ))}
                            </select>
                            {diffs.length > 0 && (
                              <p className="mt-1 text-xs text-amber-700">Date diverse: {diffs.join('; ')}</p>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{row.studentsTrained ?? '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{money(row.recognized)}</td>
                          <td className="py-2 text-right tabular-nums">{money(row.balance)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {report.total != null && (
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="py-2 pr-3 text-right text-xs font-medium text-slate-500">
                          Totale saldo
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">{money(report.total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">
                {report?.kind === 'report' ? 'Collega anche ad altri corsi (opzionale)' : 'Corsi a cui vale il documento'}
              </p>
              <IdCheckboxList
                items={otherCourses}
                selectedIds={selected}
                onToggle={toggle}
                emptyText="Nessun corso"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
              <SelectField
                label="Categoria"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              >
                {IMPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </SelectField>
              <TextField label="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
        {file && !reading && (
          <span className="text-xs text-slate-500 sm:mr-auto">
            Verrà collegato a {allCourseIds.length} {allCourseIds.length === 1 ? 'corso' : 'corsi'}
          </span>
        )}
        <SecondaryButton onClick={onClose} disabled={busy}>
          Annulla
        </SecondaryButton>
        <PrimaryButton onClick={() => void handleSave()} disabled={!file || reading || busy}>
          {busy ? 'Caricamento…' : 'Carica'}
        </PrimaryButton>
      </div>
    </Modal>
  )
}
