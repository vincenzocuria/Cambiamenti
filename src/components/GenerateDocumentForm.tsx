import { useEffect, useMemo, useState } from 'react'
import type { Course, DocumentTemplate, Person, PersonType } from '../types/db'
import { listTemplates } from '../services/templates'
import { generateFromTemplate } from '../services/generateDocument'
import { generateDocumentsBulk } from '../services/generateDocumentsBulk'
import { buildBulkDocumentJobs } from '../lib/bulkDocumentJobs'
import { metaFor } from '../data/personTypes'
import { fullName } from '../lib/format'
import { resolveTemplatePersonType, templateFits } from '../lib/templateFits'
import { PrimaryButton, SecondaryButton } from './Buttons'
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
      const role = resolveTemplatePersonType(selectedTemplate, effectivePersonType)

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

  async function handleGenerateAll() {
    if (!person) return
    const chosenCourse =
      selectableCourses.find((c) => c.id === selectedCourseId) ?? course ?? null
    const templates = available.filter((t) => !t.requires_course || chosenCourse)
    if (templates.some((t) => t.requires_course) && !chosenCourse) {
      setError('Seleziona il corso collegato')
      return
    }
    if (templates.length === 0) {
      setError('Nessun modello da generare')
      return
    }
    if (
      !window.confirm(
        `Generare ${templates.length} modell${templates.length === 1 ? 'o' : 'i'} per ${fullName(person)}?`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setInfo('')
    try {
      const result = await generateDocumentsBulk({
        course: chosenCourse,
        jobs: buildBulkDocumentJobs({
          templates,
          people: [person],
          personType: effectivePersonType,
        }),
      })
      if (result.failed) {
        setError(`${result.ok} creati, ${result.failed} errori`)
      } else {
        setInfo(`${result.ok} documenti generati e allegati.`)
      }
      if (result.ok > 0) onGenerated?.()
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

        {!course && available.some((t) => t.requires_course) && (
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
        {person && available.length > 1 && (
          <SecondaryButton type="button" disabled={busy} onClick={() => void handleGenerateAll()}>
            Genera tutti i modelli
          </SecondaryButton>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-3 text-sm text-emerald-600">{info}</p>}
    </div>
  )
}
