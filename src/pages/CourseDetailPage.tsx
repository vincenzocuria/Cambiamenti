import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Course, CourseInput } from '../types/db'
import { deleteCourse, getCourse, updateCourse } from '../services/courses'
import { fmtDate } from '../lib/format'
import { CourseForm } from '../components/CourseForm'
import { CoursePeople } from '../components/CoursePeople'
import { DangerButton, SecondaryButton } from '../components/Buttons'

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (id) getCourse(id).then(setCourse)
  }, [id])

  if (!id || !course) return <p className="text-slate-400">Caricamento…</p>

  async function handleSave(input: CourseInput) {
    const updated = await updateCourse(id!, input)
    setCourse(updated)
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Eliminare il corso "${course!.name}"? Verranno rimosse anche le iscrizioni.`)) return
    await deleteCourse(id!)
    navigate('/corsi')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/corsi" className="text-xs text-indigo-600 hover:underline">
            ← Tutti i corsi
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">
            {course.name} {course.edition && <span className="text-slate-400">· {course.edition}</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          {!editing && <SecondaryButton onClick={() => setEditing(true)}>Modifica</SecondaryButton>}
          <DangerButton onClick={() => void handleDelete()}>Elimina corso</DangerButton>
        </div>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <CourseForm initial={course} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          <Info label="Codice" value={course.code || '—'} />
          <Info label="CUP" value={course.cup || '—'} />
          <Info label="Inizio" value={fmtDate(course.start_date)} />
          <Info label="Fine" value={fmtDate(course.end_date)} />
          <Info label="Durata" value={course.duration_hours != null ? `${course.duration_hours} ore` : '—'} />
          <Info label="Note" value={course.notes || '—'} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CoursePeople courseId={id} type="student" />
        <CoursePeople courseId={id} type="teacher" />
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value}</p>
    </div>
  )
}
