import { useCallback, useEffect, useMemo, useState } from 'react'
import { PrimaryButton, SecondaryButton } from '../Buttons'
import { fieldInputClass } from '../Field'
import { CertificatesList } from './CertificatesList'
import { certificateExportColumns } from '../../lib/certificateExport'
import { downloadBlob } from '../../lib/downloadBlob'
import { fmtDate, formatCourseEdition, fullName } from '../../lib/format'
import { exportFilteredList } from '../../lib/listExport'
import {
  fmtScore,
  sortCertificates,
  studentsWithoutCertificate,
  summarizeResponses,
  surveyGroups,
  surveyIsOpen,
  surveyUrl,
  type Certificate,
  type Survey,
  type SurveySummary,
} from '../../lib/quality'
import { buildCourseDossier } from '../../services/courseDossier'
import { listCourseEnrollments } from '../../services/enrollments'
import {
  createSurvey,
  issueCertificates,
  listCertificates,
  listSurveyResponses,
  listSurveys,
  setSurveyClosed,
} from '../../services/quality'
import type { Course, Person } from '../../types/db'

const today = () => new Date().toISOString().slice(0, 10)

/** Sezione «Qualità» della scheda corso: fascicolo ZIP, attestati numerati, questionario di gradimento. */
export function CourseQualityPanel({
  course,
  students,
  teachers,
}: {
  course: Course
  students: Person[]
  teachers: Person[]
}) {
  const [certs, setCerts] = useState<Certificate[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [summary, setSummary] = useState<SurveySummary | null>(null)
  const [active, setActive] = useState<Set<string> | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [zipMsg, setZipMsg] = useState('')
  const [issuedOn, setIssuedOn] = useState(today)
  const [title, setTitle] = useState('Attestato di frequenza')
  const [hours, setHours] = useState(course.duration_hours != null ? String(course.duration_hours) : '')
  const [outcome, setOutcome] = useState('')
  const [closesOn, setClosesOn] = useState('')

  const load = useCallback(async () => {
    try {
      const [c, s, enr] = await Promise.all([listCertificates({ courseId: course.id }), listSurveys(course.id), listCourseEnrollments(course.id)])
      setCerts(sortCertificates(c))
      setSurveys(s)
      setActive(new Set([...enr.entries()].filter(([, e]) => (e.status ?? 'attivo') === 'attivo').map(([id]) => id)))
      setSummary(summarizeResponses(await listSurveyResponses(s.map((x) => x.id))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
    }
  }, [course.id])

  useEffect(() => {
    void load()
  }, [load])

  const eligible = useMemo(
    () => students.filter((s) => !active || !active.size || active.has(s.id)),
    [students, active],
  )
  const toIssue = useMemo(
    () => studentsWithoutCertificate(eligible.map((s) => s.id), certs, title.trim() || 'Attestato di frequenza'),
    [eligible, certs, title],
  )
  const survey = surveys[0] ?? null
  const link = survey ? surveyUrl(window.location.origin, survey.token) : ''

  async function run(fn: () => Promise<void>) {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  function issue() {
    const h = hours.trim() ? Number(hours.replace(',', '.')) : null
    if (h != null && (!Number.isFinite(h) || h < 0)) return setError('Ore non valide')
    if (!toIssue.length) return setError('Tutti gli allievi hanno già questo attestato')
    if (!window.confirm(`Assegno ${toIssue.length} numeri di attestato del ${issuedOn.slice(0, 4)} (in ordine alfabetico). I numeri non si cancellano. Procedo?`)) return
    void run(async () => {
      const rows = await issueCertificates({ courseId: course.id, studentIds: toIssue, issuedOn, title, hours: h, outcome })
      setInfo(rows.length ? `Rilasciati ${rows.length} attestati: dal n. ${rows[0].number}/${rows[0].year} al n. ${rows[rows.length - 1].number}/${rows[0].year}` : 'Nessun attestato nuovo')
    })
  }

  function printReceipts() {
    const valid = certs.filter((c) => !c.cancelled_at)
    exportFilteredList({
      title: `Ricevute consegna attestati – ${[course.code, course.name, formatCourseEdition(course.edition)].filter(Boolean).join(' ')}`,
      rows: [...valid].reverse(),
      columns: certificateExportColumns,
      filters: 'firma dell’allievo alla consegna',
      format: 'pdf',
    })
  }

  async function downloadDossier() {
    setError('')
    setBusy(true)
    try {
      const { zip, fileName, missing } = await buildCourseDossier(course, setZipMsg)
      downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), fileName)
      setInfo(missing.length ? `Fascicolo scaricato; ${missing.length} file non trovati: ${missing.join(', ')}` : 'Fascicolo scaricato')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fascicolo non riuscito')
    } finally {
      setZipMsg('')
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setInfo('Link copiato: incollalo nel gruppo WhatsApp o nella mail agli allievi')
    } catch {
      window.prompt('Copia il link', link)
    }
  }

  const mailBody = encodeURIComponent(
    `Gentile allieva, gentile allievo,\n\ngrazie per aver partecipato al corso «${course.name}». Ti chiediamo 3 minuti per compilare il questionario anonimo di gradimento:\n\n${link}\n\nCambia-Menti S.r.l.`,
  )

  return (
    <div className="space-y-5">
      {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">Fascicolo del corso per l'audit</p>
          <p className="text-sm text-slate-600">
            Un unico ZIP con indice e controllo di completezza, organico, allievi, calendario, presenze FAD, attestati, protocolli e tutti i documenti.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => void downloadDossier()} disabled={busy} className="shrink-0">
          {zipMsg || 'Scarica fascicolo ZIP'}
        </PrimaryButton>
      </div>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Attestati</h3>
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Data di rilascio</span>
            <input type="date" className={fieldInputClass} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Titolo</span>
            <input className={fieldInputClass} value={title} onChange={(e) => setTitle(e.target.value)} list="cert-titles" />
            <datalist id="cert-titles">
              <option value="Attestato di frequenza" />
              <option value="Attestato di frequenza e profitto" />
              <option value="Attestato di qualifica" />
              <option value="Attestato di partecipazione" />
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Ore</span>
            <input className={fieldInputClass} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Esito (facoltativo)</span>
            <input className={fieldInputClass} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="es. superato" />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <PrimaryButton type="button" onClick={issue} disabled={busy || !toIssue.length}>
              {toIssue.length ? `Rilascia ${toIssue.length} attestati numerati` : 'Attestati già rilasciati'}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={printReceipts} disabled={!certs.some((c) => !c.cancelled_at)}>
              Stampa ricevute di consegna
            </SecondaryButton>
            <span className="text-xs text-slate-500">
              {eligible.length} allievi attivi{students.length > eligible.length ? ` (${students.length - eligible.length} ritirati o trasferiti esclusi)` : ''}
            </span>
          </div>
        </div>
        <CertificatesList rows={certs} resetKey={course.id} showCourse={false} onChanged={load} onError={setError} />
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Questionario di gradimento</h3>
        {!survey ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="w-full text-sm text-slate-600">
              Crea il link e mandalo agli allievi a fine corso. Le risposte sono anonime; ognuno vota anche i docenti.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Chiusura (facoltativa)</span>
              <input type="date" className={fieldInputClass} value={closesOn} onChange={(e) => setClosesOn(e.target.value)} />
            </label>
            <PrimaryButton type="button" disabled={busy} onClick={() => void run(async () => void (await createSurvey(course.id, closesOn || null)))}>
              Crea il link del questionario
            </PrimaryButton>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${surveyIsOpen(survey, today()) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
              >
                {surveyIsOpen(survey, today()) ? 'Aperto' : 'Chiuso'}
                {survey.closes_on && !survey.closed_at ? ` fino al ${fmtDate(survey.closes_on)}` : ''}
              </span>
              <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{link}</code>
            </div>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton size="sm" type="button" onClick={() => void copyLink()}>
                Copia link
              </SecondaryButton>
              <a
                className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                href={`https://wa.me/?text=${mailBody}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a
                className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                href={`mailto:?bcc=${encodeURIComponent(eligible.map((s) => s.email).filter(Boolean).join(','))}&subject=${encodeURIComponent(`Questionario di gradimento – ${course.name}`)}&body=${mailBody}`}
              >
                Email agli allievi (ccn)
              </a>
              <a className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" href={link} target="_blank" rel="noopener noreferrer">
                Apri
              </a>
              <SecondaryButton size="sm" type="button" disabled={busy} onClick={() => void run(() => setSurveyClosed(survey.id, !survey.closed_at))}>
                {survey.closed_at ? 'Riapri' : 'Chiudi il questionario'}
              </SecondaryButton>
            </div>
            {summary && summary.responses > 0 ? (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <p className="text-sm text-slate-700">
                  <strong>{summary.responses}</strong> risposte su {eligible.length} allievi · media <strong>{fmtScore(summary.overall)}</strong> su 5 ·
                  soddisfatti {summary.satisfiedShare != null ? `${Math.round(summary.satisfiedShare * 100)}%` : '—'}
                </p>
                <div className="grid gap-2 sm:grid-cols-5">
                  {surveyGroups.map((g) => (
                    <div key={g.id} className="rounded-lg bg-slate-50 p-2 text-center">
                      <p className="text-xs text-slate-500">{g.title}</p>
                      <p className="text-lg font-semibold text-slate-900">{fmtScore(summary.byGroup[g.id])}</p>
                    </div>
                  ))}
                </div>
                {Object.keys(summary.byTeacher).length > 0 && (
                  <p className="text-sm text-slate-600">
                    Docenti:{' '}
                    {Object.entries(summary.byTeacher)
                      .map(([id, t]) => `${teacherName(id)} ${fmtScore(t.mean)} (${t.count})`)
                      .join(' · ')}
                  </p>
                )}
                {summary.comments.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-indigo-600">Commenti ({summary.comments.length})</summary>
                    <ul className="mt-2 space-y-2">
                      {summary.comments.map((c, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-2 text-slate-700">
                          {c.liked && <p>👍 {c.liked}</p>}
                          {c.suggestions && <p>💡 {c.suggestions}</p>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nessuna risposta ancora.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )

  function teacherName(id: string): string {
    const t = teachers.find((p) => p.id === id)
    return t ? fullName(t) : 'Docente'
  }
}
