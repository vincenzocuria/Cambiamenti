import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SecondaryButton } from '../Buttons'
import { KpiCards } from '../KpiCards'
import { exportFilteredList, type ExportColumn } from '../../lib/listExport'
import { courseLabel } from '../../lib/protocol'
import { fmtScore, summarizeResponses, surveyGroups, type SurveySummary } from '../../lib/quality'
import { listCourses } from '../../services/courses'
import { listPeopleNames, listSurveyResponses, listSurveys } from '../../services/quality'
import type { Course } from '../../types/db'

interface CourseRow {
  course: Course
  summary: SurveySummary
}

interface TeacherRow {
  id: string
  name: string
  mean: number | null
  count: number
  courses: number
}

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)

const courseColumns: ExportColumn<CourseRow>[] = [
  { header: 'Corso', value: (r) => courseLabel(r.course) },
  { header: 'Risposte', value: (r) => String(r.summary.responses) },
  ...surveyGroups.map((g) => ({ header: g.title, value: (r: CourseRow) => fmtScore(r.summary.byGroup[g.id]) })),
  { header: 'Media', value: (r) => fmtScore(r.summary.overall) },
  { header: 'Soddisfatti', value: (r) => pct(r.summary.satisfiedShare) },
]

const teacherColumns: ExportColumn<TeacherRow>[] = [
  { header: 'Docente', value: (r) => r.name },
  { header: 'Media (1-5)', value: (r) => fmtScore(r.mean) },
  { header: 'Valutazioni', value: (r) => String(r.count) },
  { header: 'Corsi', value: (r) => String(r.courses) },
  { header: 'Esito', value: (r) => (r.mean == null ? '' : r.mean >= 3.5 ? 'Confermato' : 'Da monitorare') },
]

/** Gradimento di tutti i corsi e valutazione dei docenti dai questionari degli allievi. */
export function SurveysTab() {
  const [courseRows, setCourseRows] = useState<CourseRow[]>([])
  const [teacherRows, setTeacherRows] = useState<TeacherRow[]>([])
  const [all, setAll] = useState<SurveySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const [surveys, courses] = await Promise.all([listSurveys(), listCourses()])
        const responses = await listSurveyResponses(surveys.map((s) => s.id))
        const courseOf = new Map(surveys.map((s) => [s.id, s.course_id]))
        const byCourse = new Map<string, typeof responses>()
        for (const r of responses) {
          const cid = courseOf.get(r.survey_id)
          if (cid) byCourse.set(cid, [...(byCourse.get(cid) ?? []), r])
        }
        const courseById = new Map(courses.map((c) => [c.id, c]))
        const rows = [...new Set(surveys.map((s) => s.course_id))]
          .map((cid) => courseById.get(cid))
          .filter((c): c is Course => !!c)
          .map((course) => ({ course, summary: summarizeResponses(byCourse.get(course.id) ?? []) }))
          .sort((a, b) => (b.course.start_date ?? '').localeCompare(a.course.start_date ?? ''))
        setCourseRows(rows)
        const total = summarizeResponses(responses)
        setAll(total)

        const teacherCourses = new Map<string, Set<string>>()
        for (const r of responses) {
          for (const id of Object.keys(r.teacher_scores ?? {})) {
            const cid = courseOf.get(r.survey_id) ?? ''
            teacherCourses.set(id, (teacherCourses.get(id) ?? new Set()).add(cid))
          }
        }
        const names = await listPeopleNames([...teacherCourses.keys()])
        setTeacherRows(
          Object.entries(total.byTeacher)
            .map(([id, t]) => ({ id, name: names.get(id) ?? 'Docente', mean: t.mean, count: t.count, courses: teacherCourses.get(id)?.size ?? 0 }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toMonitor = useMemo(() => teacherRows.filter((t) => t.mean != null && t.mean < 3.5).length, [teacherRows])

  if (loading) return <p className="text-sm text-slate-500">Carico…</p>

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <KpiCards
        compact
        className="mb-0"
        items={[
          { key: 'corsi', label: 'Corsi con questionario', value: courseRows.length },
          { key: 'risposte', label: 'Risposte raccolte', value: all?.responses ?? 0 },
          { key: 'media', label: 'Media complessiva', value: fmtScore(all?.overall), hint: 'su 5', tone: all?.overall != null && all.overall >= 3.5 ? 'ok' : 'default' },
          { key: 'doc', label: 'Docenti da monitorare', value: toMonitor, hint: 'media sotto 3,5', tone: toMonitor ? 'warn' : 'ok' },
        ]}
      />
      <p className="text-sm text-slate-500">
        Il link del questionario si crea dalla scheda del corso, sezione «Qualità», e si manda agli allievi a fine corso. Le risposte sono anonime.
      </p>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Gradimento per corso</h2>
          <SecondaryButton
            size="sm"
            type="button"
            disabled={!courseRows.length}
            onClick={() => exportFilteredList({ title: 'Gradimento per corso', rows: courseRows, columns: courseColumns, format: 'excel' })}
          >
            Excel
          </SecondaryButton>
        </div>
        {!courseRows.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nessun questionario ancora creato.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Corso</th>
                  <th className="px-3 py-2">Risposte</th>
                  {surveyGroups.map((g) => (
                    <th key={g.id} className="px-3 py-2">
                      {g.title}
                    </th>
                  ))}
                  <th className="px-3 py-2">Media</th>
                  <th className="px-3 py-2">Soddisfatti</th>
                </tr>
              </thead>
              <tbody>
                {courseRows.map((r) => (
                  <tr key={r.course.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link to={`/corsi/${r.course.id}`} className="text-indigo-600 hover:underline">
                        {courseLabel(r.course)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.summary.responses}</td>
                    {surveyGroups.map((g) => (
                      <td key={g.id} className="px-3 py-2">
                        {fmtScore(r.summary.byGroup[g.id])}
                      </td>
                    ))}
                    <td className="px-3 py-2 font-semibold">{fmtScore(r.summary.overall)}</td>
                    <td className="px-3 py-2">{pct(r.summary.satisfiedShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Valutazione dei docenti</h2>
            <p className="text-xs text-slate-500">Dai voti degli allievi. Sotto 3,5 il docente va monitorato (criterio da confermare nella procedura PR-01).</p>
          </div>
          <SecondaryButton
            size="sm"
            type="button"
            disabled={!teacherRows.length}
            onClick={() => exportFilteredList({ title: 'Valutazione docenti', rows: teacherRows, columns: teacherColumns, format: 'pdf' })}
          >
            Scheda PDF
          </SecondaryButton>
        </div>
        {!teacherRows.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nessuna valutazione dei docenti ancora.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {teacherRows.map((t) => (
              <Link
                key={t.id}
                to={`/personale/${t.id}`}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-indigo-300"
              >
                <p className="font-medium text-slate-800">{t.name}</p>
                <p className={`text-2xl font-semibold ${t.mean != null && t.mean < 3.5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {fmtScore(t.mean)}
                </p>
                <p className="text-xs text-slate-500">
                  {t.count} valutazioni · {t.courses} {t.courses === 1 ? 'corso' : 'corsi'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
