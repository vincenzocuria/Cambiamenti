import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Course, CourseInput, Person, PersonType } from '../types/db'
import { deleteCourse, getCourse, updateCourse } from '../services/courses'
import { listCoursePeople } from '../services/enrollments'
import { fetchCourseStaffingCounts } from '../services/courseStaffing'
import type { CourseStaffingCounts } from '../data/courseStaffing'
import { fmtDate, formatCourseEdition, fullName } from '../lib/format'
import { CourseForm } from '../components/CourseForm'
import { CoursePeople } from '../components/CoursePeople'
import { CourseStaffingStatus } from '../components/CourseStaffingStatus'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { CourseStatusPipeline } from '../components/CourseStatusPipeline'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { GenerateDocumentForm } from '../components/GenerateDocumentForm'
import { BulkGenerateDocumentsForm } from '../components/BulkGenerateDocumentsForm'
import { DangerButton, SecondaryButton } from '../components/Buttons'
import { SegmentedControl } from '../components/SegmentedControl'
import { courseStatusMeta, isCourseStatus } from '../data/courseStatus'
import { takenStaffIds } from '../lib/takenStaffIds'
import { formatCourseShareLabel } from '../lib/fadShareMessage'
import { FadShareBulk } from '../components/FadShareBulk'
import { FadMoodleSync } from '../components/FadMoodleSync'

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

  const courseLabel = formatCourseShareLabel(course)
  const editionLabel = formatCourseEdition(course.edition)

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
    <div className="space-y-8">
      <div>
        <Link to="/corsi" className="text-xs font-medium text-indigo-600 hover:underline">
          ← Tutti i corsi
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="min-w-0 text-2xl font-bold leading-tight text-slate-800">
            {course.name}
            {editionLabel && (
              <span className="font-medium text-slate-400"> · {editionLabel}</span>
            )}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {!editing && <SecondaryButton onClick={() => setEditing(true)}>Modifica</SecondaryButton>}
            <DangerButton size="md" onClick={() => void handleDelete()}>
              Elimina corso
            </DangerButton>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CourseStatusBadge status={course.status} />
            {isCourseStatus(course.status) && (
              <span className="text-xs text-slate-500">
                {courseStatusMeta[course.status].description}
              </span>
            )}
          </div>
          {isCourseStatus(course.status) && <CourseStatusPipeline status={course.status} />}
        </div>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <CourseForm initial={course} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-3 lg:grid-cols-4">
          <Info label="Codice" value={course.code || '—'} />
          <Info label="CUP" value={course.cup || '—'} />
          <Info label="Inizio" value={fmtDate(course.start_date)} />
          <Info label="Fine" value={fmtDate(course.end_date)} />
          <Info
            label="Durata"
            value={course.duration_hours != null ? `${course.duration_hours} ore` : '—'}
          />
          <Info label="Note" value={course.notes || '—'} className="col-span-2 sm:col-span-2 lg:col-span-3" />
        </div>
      )}

      <CourseStaffingStatus counts={staffing} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Persone del corso</h2>
          <p className="mt-1 text-sm text-slate-500">
            Stessa anagrafica del personale: su questo corso ogni figura ha un solo ruolo.
          </p>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <CoursePeople
            courseId={id}
            type="teacher"
            takenPersonIds={staffTakenIds}
            showStaffPoolHint={false}
            fadShareChannels={false}
            onChanged={() => void reloadStaff()}
          />
          <CoursePeople
            courseId={id}
            type="tutor"
            takenPersonIds={staffTakenIds}
            showStaffPoolHint={false}
            fadShareChannels={false}
            onChanged={() => void reloadStaff()}
          />
          <CoursePeople
            courseId={id}
            type="admin_staff"
            takenPersonIds={staffTakenIds}
            showStaffPoolHint={false}
            fadShareChannels={false}
            onChanged={() => void reloadStaff()}
          />
        </div>
        <CoursePeople
          courseId={id}
          type="student"
          fadShareChannels={false}
          onChanged={() => void reloadStaff()}
        />
      </section>

      <FadShareBulk peopleByType={peopleByType} courseLabel={courseLabel} />

      <FadMoodleSync courseId={id} />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Documenti da generare</h2>
          <p className="mt-1 text-sm text-slate-500">
            Scegli il ruolo e se creare i documenti in massa o uno alla volta.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            ariaLabel="Ruolo dei documenti"
            value={peopleType}
            onChange={setPeopleType}
            options={genRoles.map((role) => ({ value: role.type, label: role.label }))}
          />
          <SegmentedControl
            ariaLabel="Modalità di generazione"
            value={genMode}
            onChange={setGenMode}
            options={[
              { value: 'bulk', label: 'In massa' },
              { value: 'single', label: 'Singolo' },
            ]}
          />
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
      </section>

      <DocumentsPanel
        key={docsKey}
        mode="course"
        courseId={id}
        personNames={personNames}
      />
    </div>
  )
}

function Info({
  label,
  value,
  className = '',
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="mt-1 break-words font-medium text-slate-800">{value}</div>
    </div>
  )
}
