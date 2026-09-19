import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Course, CourseInput } from '../types/db'
import { createCourse, listCourses } from '../services/courses'
import { fmtDate } from '../lib/format'
import { CourseForm } from '../components/CourseForm'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { PrimaryButton } from '../components/Buttons'
import {
  tableWideClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadRowClass,
  trClass,
} from '../lib/tableStyles'

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

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

  const filtered = courses.filter((c) =>
    `${c.name} ${c.edition} ${c.code} ${c.cup}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Corsi</h1>
        {!creating && <PrimaryButton onClick={() => setCreating(true)}>+ Nuovo corso</PrimaryButton>}
      </div>

      {creating && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-700">Nuovo corso</h2>
          <CourseForm onSave={handleCreate} onCancel={() => setCreating(false)} />
        </div>
      )}

      <input
        type="search"
        placeholder="Cerca per nome, edizione, codice o CUP…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
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
                  Nessun corso trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
