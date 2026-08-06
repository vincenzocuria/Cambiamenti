import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Course, CourseInput } from '../types/db'
import { createCourse, listCourses } from '../services/courses'
import { fmtDate } from '../lib/format'
import { CourseForm } from '../components/CourseForm'
import { PrimaryButton } from '../components/Buttons'

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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-3">Corso</th>
              <th>Edizione</th>
              <th>Codice</th>
              <th>CUP</th>
              <th>Inizio</th>
              <th>Fine</th>
              <th>Ore</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/corsi/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td>{c.edition || '—'}</td>
                <td>{c.code || '—'}</td>
                <td>{c.cup || '—'}</td>
                <td>{fmtDate(c.start_date)}</td>
                <td>{fmtDate(c.end_date)}</td>
                <td>{c.duration_hours ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
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
