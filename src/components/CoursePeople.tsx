import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Person, PersonType } from '../types/db'
import { addToCourse, listCoursePeople, removeFromCourse } from '../services/enrollments'
import { listPeople } from '../services/people'
import { fullName } from '../lib/format'
import { DangerButton, SecondaryButton } from './Buttons'

interface Props {
  courseId: string
  type: PersonType
}

const labels: Record<PersonType, { title: string; basePath: string; add: string }> = {
  student: { title: 'Alunni iscritti', basePath: '/alunni', add: 'Iscrivi alunno' },
  teacher: { title: 'Docenti assegnati', basePath: '/docenti', add: 'Assegna docente' },
}

export function CoursePeople({ courseId, type }: Props) {
  const [enrolled, setEnrolled] = useState<Person[]>([])
  const [all, setAll] = useState<Person[]>([])
  const [selected, setSelected] = useState('')
  const l = labels[type]

  async function reload() {
    setEnrolled(await listCoursePeople(type, courseId))
  }

  useEffect(() => {
    void reload()
    listPeople(type).then(setAll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, type])

  const available = all.filter((p) => !enrolled.some((e) => e.id === p.id))

  async function handleAdd() {
    if (!selected) return
    await addToCourse(type, courseId, selected)
    setSelected('')
    await reload()
  }

  async function handleRemove(personId: string) {
    await removeFromCourse(type, courseId, personId)
    await reload()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        {l.title} ({enrolled.length})
      </h3>
      <div className="mb-3 flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">— seleziona —</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {fullName(p)} {p.tax_code ? `(${p.tax_code})` : ''}
            </option>
          ))}
        </select>
        <SecondaryButton onClick={() => void handleAdd()} disabled={!selected}>
          {l.add}
        </SecondaryButton>
      </div>
      {enrolled.length === 0 ? (
        <p className="text-sm text-slate-400">Nessuno associato a questo corso.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {enrolled.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <Link to={`${l.basePath}/${p.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                {fullName(p)}
              </Link>
              <DangerButton onClick={() => void handleRemove(p.id)}>Rimuovi</DangerButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
