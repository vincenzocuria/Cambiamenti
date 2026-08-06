import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Counts {
  courses: number
  students: number
  teachers: number
}

async function fetchCount(table: 'courses' | 'students' | 'teachers'): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

const cards = [
  { key: 'courses', label: 'Corsi', to: '/corsi' },
  { key: 'students', label: 'Alunni', to: '/alunni' },
  { key: 'teachers', label: 'Docenti', to: '/docenti' },
] as const

export function DashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    Promise.all([fetchCount('courses'), fetchCount('students'), fetchCount('teachers')]).then(
      ([courses, students, teachers]) => setCounts({ courses, students, teachers }),
    )
  }, [])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.key}
            to={c.to}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow"
          >
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 text-4xl font-bold text-indigo-700">{counts ? counts[c.key] : '…'}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
