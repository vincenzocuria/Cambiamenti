import { useEffect, useMemo, useState } from 'react'
import type { Course, DocumentTemplate, Person, PersonType } from '../types/db'
import { listTemplates } from '../services/templates'
import { generateFromTemplate } from '../services/generateDocument'
import { metaFor } from '../data/personTypes'
import { fullName } from '../lib/format'
import { PrimaryButton } from './Buttons'
import { SelectField } from './Field'

type Props = {
  course?: Course | null
  courses?: Course[]
  person?: Person | null
  personType?: PersonType | null
  people?: Person[]
  peopleType?: PersonType
  onGenerated?: () => void
}

function roleMatches(templateRole: string, personType: PersonType | null): boolean {
  if (!personType) return true
  if (templateRole === 'any' || templateRole === 'staff') {
    return (
      personType === 'staff' ||
      personType === 'teacher' ||
      personType === 'tutor' ||
      personType === 'admin_staff'
    )
  }
  if (personType === 'staff') {
    return (
      templateRole === 'teacher' ||
      templateRole === 'tutor' ||
      templateRole === 'admin_staff' ||
      templateRole === 'staff'
    )
  }
  return templateRole === personType
}

function templateFits(
  t: DocumentTemplate,
  opts: { canHaveCourse: boolean; personType: PersonType | null; canPickPerson: boolean },
): boolean {
  if (t.requires_course && !opts.canHaveCourse) return false
  if (t.person_role === 'none') return true
  if (opts.canPickPerson) {
    if (!opts.personType) return true
    return roleMatches(t.person_role, opts.personType)
  }
  return roleMatches(t.person_role, opts.personType)
}

export function GenerateDocumentForm({
  course = null,
  courses = [],
  person = null,
  personType = null,
  people = [],
  peopleType,
  onGenerated,
}: Props) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState(person?.id ?? '')
  const [selectedCourseId, setSelectedCourseId] = useState(course?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [tick])

  useEffect(() => {
    if (person?.id) setSelectedPersonId(person.id)
  }, [person?.id])

  useEffect(() => {
    if (course?.id) setSelectedCourseId(course.id)
  }, [course?.id])

  const effectivePersonType = personType ?? peopleType ?? null
  const selectablePeople = person ? [person] : people
  const selectableCourses = course ? [course] : courses
  const canHaveCourse = Boolean(course) || courses.length > 0
  const canPickPerson = Boolean(person) || people.length > 0

  const available = useMemo(
    () =>
      templates.filter((t) =>
        templateFits(t, {
          canHaveCourse,
          personType: effectivePersonType,
          canPickPerson: canPickPerson || t.person_role === 'none',
        }),
      ),
    [templates, canHaveCourse, effectivePersonType, canPickPerson],
  )

  const selectedTemplate = available.find((t) => t.id === templateId) ?? null

  async function handleGenerate() {
    if (!selectedTemplate) {
      setError('Seleziona un template')
      return
    }

    const chosenPerson =
      selectablePeople.find((p) => p.id === selectedPersonId) ?? person ?? null
    const chosenCourse =
      selectableCourses.find((c) => c.id === selectedCourseId) ?? course ?? null

    if (selectedTemplate.requires_course && !chosenCourse) {
      setError('Seleziona il corso collegato')
      return
    }
    if (selectedTemplate.person_role !== 'none' && !chosenPerson) {
      setError('Seleziona la persona per cui generare il documento')
      return
    }

    setBusy(true)
    setError('')
    setInfo('')
    try {
      const role: PersonType | null =
        selectedTemplate.person_role === 'any' || selectedTemplate.person_role === 'none'
          ? effectivePersonType
          : selectedTemplate.person_role

      await generateFromTemplate({
        template: selectedTemplate,
        course: chosenCourse,
        person: chosenPerson,
        personType: chosenPerson ? role : null,
      })
      setInfo('Documento generato e allegato.')
      onGenerated?.()
      setTick((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generazione fallita')
    } finally {
      setBusy(false)
    }
  }

  if (available.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        Nessun template compatibile. Caricane uno nella sezione Template.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Genera da template</h3>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">— seleziona —</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>

        {selectedTemplate?.requires_course && !course && (
          <SelectField
            label="Corso"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="">— seleziona —</option>
            {selectableCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.edition}
              </option>
            ))}
          </SelectField>
        )}

        {selectedTemplate && selectedTemplate.person_role !== 'none' && !person && (
          <SelectField
            label={
              peopleType
                ? metaFor(peopleType).singular
                : selectedTemplate.person_role === 'any'
                  ? 'Persona'
                  : metaFor(selectedTemplate.person_role as PersonType).singular
            }
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
          >
            <option value="">— seleziona —</option>
            {selectablePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </SelectField>
        )}

        <PrimaryButton type="button" disabled={busy} onClick={() => void handleGenerate()}>
          {busy ? 'Generazione…' : 'Genera documento'}
        </PrimaryButton>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-3 text-sm text-emerald-600">{info}</p>}
    </div>
  )
}
