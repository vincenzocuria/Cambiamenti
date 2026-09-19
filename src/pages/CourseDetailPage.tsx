import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Course, CourseInput, Person, PersonType } from '../types/db'
import { deleteCourse, getCourse, updateCourse } from '../services/courses'
import { listCoursePeople } from '../services/enrollments'
import { fetchCourseStaffingCounts } from '../services/courseStaffing'
import type { CourseStaffingCounts } from '../data/courseStaffing'
import { fmtDate, fullName } from '../lib/format'
import { CourseForm } from '../components/CourseForm'
import { CoursePeople } from '../components/CoursePeople'
import { CourseStaffingStatus } from '../components/CourseStaffingStatus'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { CourseStatusPipeline } from '../components/CourseStatusPipeline'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { GenerateDocumentForm } from '../components/GenerateDocumentForm'
import { BulkGenerateDocumentsForm } from '../components/BulkGenerateDocumentsForm'
import { DangerButton, SecondaryButton } from '../components/Buttons'
import { courseStatusMeta, isCourseStatus } from '../data/courseStatus'
import { takenStaffIds } from '../lib/takenStaffIds'

const genRoles: { type: PersonType; label: string }[] = [
  { type: 'teacher', label: 'Docente' },
  { type: 'tutor', label: 'Tutor' },
  { type: 'admin_staff', label: 'Amministrativo' },
  { type: 'student', label: 'Alunno' },
]

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [editing, setEditing] = useState(false)
  const [staffing, setStaffing] = useState<CourseStaffingCounts>({
    teacher: 0,
    tutor: 0,
    admin_staff: 0,
  })
  const [peopleByType, setPeopleByType] = useState<Partial<Record<PersonType, Person[]>>>({
    student: [],
    teacher: [],
    tutor: [],
    admin_staff: [],
  })
  const [docsKey, setDocsKey] = useState(0)
  const [peopleType, setPeopleType] = useState<PersonType>('student')
  const [genMode, setGenMode] = useState<'single' | 'bulk'>('bulk')
  const staffTakenIds = useMemo(() => takenStaffIds(peopleByType), [peopleByType])
  const personNames = useMemo(
    () =>
      Object.fromEntries(
        Object.values(peopleByType)
          .flat()
          .filter((p): p is Person => Boolean(p))
          .map((p) => [p.id, fullName(p)]),
      ),
    [peopleByType],
  )

  async function reloadStaff() {
    if (!id) return
    const [counts, students, teachers, tutors, admins] = await Promise.all([
      fetchCourseStaffingCounts(id),
      listCoursePeople('student', id),
      listCoursePeople('teacher', id),
      listCoursePeople('tutor', id),
      listCoursePeople('admin_staff', id),
    ])
    setStaffing(counts)
    setPeopleByType({
      student: students,
      teacher: teachers,
      tutor: tutors,
      admin_staff: admins,
    })
  }

  useEffect(() => {
    if (id) {
      getCourse(id).then(setCourse)
      void reloadStaff()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!id || !course) return <p className="text-slate-400">Caricamento…</p>

  async function handleSave(input: CourseInput) {
    const updated = await updateCourse(id!, input)
    setCourse(updated)
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Eliminare il corso "${course!.name}"? Verranno rimosse anche le iscrizioni.`))
      return
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
            {course.name}{' '}
            {course.edition && <span className="text-slate-400">· {course.edition}</span>}
          </h1>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CourseStatusBadge status={course.status} />
              {isCourseStatus(course.status) && (
                <span className="text-xs text-slate-500">
                  {courseStatusMeta[course.status].description}
                </span>
              )}
            </div>
            {isCourseStatus(course.status) && (
              <CourseStatusPipeline status={course.status} />
            )}
          </div>
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
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-3 lg:grid-cols-4">
          <Info label="Stato" value={<CourseStatusBadge status={course.status} />} />
          <Info label="Codice" value={course.code || '—'} />
          <Info label="CUP" value={course.cup || '—'} />
          <Info label="Inizio" value={fmtDate(course.start_date)} />
          <Info label="Fine" value={fmtDate(course.end_date)} />
          <Info
            label="Durata"
            value={course.duration_hours != null ? `${course.duration_hours} ore` : '—'}
          />
          <Info label="Note" value={course.notes || '—'} />
        </div>
      )}

      <CourseStaffingStatus counts={staffing} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CoursePeople
          courseId={id}
          type="teacher"
          takenPersonIds={staffTakenIds}
          onChanged={() => void reloadStaff()}
        />
        <CoursePeople
          courseId={id}
          type="tutor"
          takenPersonIds={staffTakenIds}
          onChanged={() => void reloadStaff()}
        />
        <CoursePeople
          courseId={id}
          type="admin_staff"
          takenPersonIds={staffTakenIds}
          onChanged={() => void reloadStaff()}
        />
        <CoursePeople courseId={id} type="student" onChanged={() => void reloadStaff()} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {genRoles.map((r) => (
            <SecondaryButton
              key={r.type}
              type="button"
              onClick={() => setPeopleType(r.type)}
              className={peopleType === r.type ? 'border-indigo-300 bg-indigo-50' : ''}
            >
              Genera per {r.label.toLowerCase()}
            </SecondaryButton>
          ))}
          <span className="hidden h-6 w-px bg-slate-200 sm:block" />
          <SecondaryButton
            type="button"
            onClick={() => setGenMode('bulk')}
            className={genMode === 'bulk' ? 'border-indigo-300 bg-indigo-50' : ''}
          >
            In massa
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => setGenMode('single')}
            className={genMode === 'single' ? 'border-indigo-300 bg-indigo-50' : ''}
          >
            Singolo
          </SecondaryButton>
        </div>
        {genMode === 'bulk' ? (
          <BulkGenerateDocumentsForm
            course={course}
            people={peopleByType[peopleType] ?? []}
            peopleType={peopleType}
            onGenerated={() => setDocsKey((n) => n + 1)}
          />
        ) : (
          <GenerateDocumentForm
            course={course}
            people={peopleByType[peopleType] ?? []}
            peopleType={peopleType}
            onGenerated={() => setDocsKey((n) => n + 1)}
          />
        )}
      </div>

      <DocumentsPanel
        key={docsKey}
        mode="course"
        courseId={id}
        personNames={personNames}
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <div className="font-medium text-slate-700">{value}</div>
    </div>
  )
}
