import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Course, CourseInput } from '../types/db'
import { createCourse, listCourses } from '../services/courses'
import {
  courseStatusMeta,
  courseStatuses,
  isCourseStatus,
  type CourseStatus,
} from '../data/courseStatus'
import { fmtDate } from '../lib/format'
import { matchesSearch } from '../lib/matchesSearch'
import { describeFilters, exportFilteredList } from '../lib/listExport'
import { useListQuery } from '../hooks/useListQuery'
import { CourseForm } from '../components/CourseForm'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { PrimaryButton } from '../components/Buttons'
import { KpiCards } from '../components/KpiCards'
import { StatusFilterCards } from '../components/StatusFilterCards'
import { ListToolbar } from '../components/ListToolbar'
import {
  tableWideClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadRowClass,
  trClass,
} from '../lib/tableStyles'

function countStatus(courses: Course[], status: CourseStatus): number {
  return courses.filter((c) => c.status === status).length
}

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [creating, setCreating] = useState(false)
  const { search, status: rawStatus, setSearch, setStatus } = useListQuery()
  const status = isCourseStatus(rawStatus) ? rawStatus : ''

  async function reload() {
    setCourses(await listCourses())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleCreate(input: CourseInput) {
    await createCourse(input)
    setCreating(false)
    await reload()
  }

  const searched = useMemo(
    () =>
      courses.filter((c) =>
        matchesSearch(`${c.name} ${c.edition} ${c.code} ${c.cup}`, search),
      ),
    [courses, search],
  )

  const filtered = useMemo(
    () => (status ? searched.filter((c) => c.status === status) : searched),
    [searched, status],
  )

  const inCorso = countStatus(courses, 'in_corso')
  const prossimi = countStatus(courses, 'in_attivazione')
  const daRendicontare = countStatus(courses, 'finito')
  const esitoChiuso = countStatus(courses, 'esito_chiuso')
  const statusLabel = status ? courseStatusMeta[status as CourseStatus]?.label : ''

  function toggleStatus(key: string) {
    setStatus(status === key ? '' : key)
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: 'Corsi',
      rows: filtered,
      format,
      filters: describeFilters([statusLabel, search && `ricerca «${search}»`]),
      columns: [
        { header: 'Corso', value: (c) => c.name },
        { header: 'Edizione', value: (c) => c.edition || '' },
        { header: 'Stato', value: (c) => courseStatusMeta[c.status]?.label ?? c.status },
        { header: 'Codice', value: (c) => c.code || '' },
        { header: 'CUP', value: (c) => c.cup || '' },
        { header: 'Inizio', value: (c) => fmtDate(c.start_date) },
        { header: 'Fine', value: (c) => fmtDate(c.end_date) },
        { header: 'Ore', value: (c) => (c.duration_hours != null ? String(c.duration_hours) : '') },
      ],
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Corsi</h1>
        {!creating && <PrimaryButton onClick={() => setCreating(true)}>+ Nuovo corso</PrimaryButton>}
      </div>

      <KpiCards
        items={[
          {
            key: 'totale',
            label: 'Totale corsi',
            hint: 'Tutti gli step',
            value: courses.length,
            active: !status,
            onClick: () => setStatus(''),
          },
          {
            key: 'in_corso',
            label: 'In corso',
            hint: 'Formazione attiva',
            value: inCorso,
            tone: 'ok',
            active: status === 'in_corso',
            onClick: () => toggleStatus('in_corso'),
          },
          {
            key: 'in_attivazione',
            label: 'Prossimi',
            hint: 'In attivazione',
            value: prossimi,
            active: status === 'in_attivazione',
            onClick: () => toggleStatus('in_attivazione'),
          },
          {
            key: 'finito',
            label: 'Da rendicontare',
            hint: 'Finiti in attesa',
            value: daRendicontare,
            tone: daRendicontare > 0 ? 'warn' : 'ok',
            active: status === 'finito',
            onClick: () => toggleStatus('finito'),
          },
          {
            key: 'esito_chiuso',
            label: 'Esito chiuso',
            hint: 'Ciclo completato',
            value: esitoChiuso,
            active: status === 'esito_chiuso',
            onClick: () => toggleStatus('esito_chiuso'),
          },
        ]}
      />

      <StatusFilterCards
        allCount={courses.length}
        value={status}
        onChange={setStatus}
        items={courseStatuses.map((s) => ({
          key: s,
          label: courseStatusMeta[s].label,
          count: countStatus(courses, s),
          tone: s === 'finito' ? 'warn' : s === 'in_corso' ? 'ok' : 'default',
        }))}
      />

      {creating && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-700">Nuovo corso</h2>
          <CourseForm onSave={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Cerca per nome, edizione, codice o CUP…"
        resultCount={filtered.length}
        totalCount={courses.length}
        unitSingular="corso"
        unitPlural="corsi"
        onExportExcel={() => exportList('excel')}
        onExportPdf={() => exportList('pdf')}
      />

      <div className={tableWrapClass}>
        <table className={tableWideClass}>
          <thead>
            <tr className={theadRowClass}>
              <th className={thClass}>Corso</th>
              <th className={thClass}>Edizione</th>
              <th className={thClass}>Stato</th>
              <th className={thClass}>Codice</th>
              <th className={thClass}>CUP</th>
              <th className={thClass}>Inizio</th>
              <th className={thClass}>Fine</th>
              <th className={thClass}>Ore</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className={trClass}>
                <td className={tdClass}>
                  <Link to={`/corsi/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className={tdClass}>{c.edition || '—'}</td>
                <td className={tdClass}>
                  <CourseStatusBadge status={c.status} />
                </td>
                <td className={tdClass}>{c.code || '—'}</td>
                <td className={tdClass}>{c.cup || '—'}</td>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  {fmtDate(c.start_date)}
                </td>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  {fmtDate(c.end_date)}
                </td>
                <td className={tdClass}>{c.duration_hours ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className={`${tdClass} py-10 text-center text-slate-400`}>
                  {courses.length === 0
                    ? 'Nessun corso trovato.'
                    : 'Nessun risultato per i filtri selezionati.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
