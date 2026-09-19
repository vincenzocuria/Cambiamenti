import { useEffect, useMemo, useState } from 'react'
import type { Course, DocumentRow, DocumentTemplate, Person, PersonType } from '../types/db'
import { metaFor } from '../data/personTypes'
import { fullName } from '../lib/format'
import { allIds, toggleId } from '../lib/toggleIdSet'
import { templateFits } from '../lib/templateFits'
import { buildBulkDocumentJobs, filterBulkJobs } from '../lib/bulkDocumentJobs'
import { listTemplates } from '../services/templates'
import { listDocuments } from '../services/documents'
import { generateDocumentsBulk } from '../services/generateDocumentsBulk'
import { IdCheckboxList } from './IdCheckboxList'
import { PrimaryButton, SecondaryButton } from './Buttons'

type Props = {
  course: Course
  people: Person[]
  peopleType: PersonType
  onGenerated?: () => void
}

export function BulkGenerateDocumentsForm({ course, people, peopleType, onGenerated }: Props) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [existingDocs, setExistingDocs] = useState<DocumentRow[]>([])
  const [templateIds, setTemplateIds] = useState<Set<string>>(new Set())
  const [personIds, setPersonIds] = useState<Set<string>>(new Set())
  const [skipExisting, setSkipExisting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [info, setInfo] = useState('')
  const [failures, setFailures] = useState<string[]>([])

  const meta = metaFor(peopleType)

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    listDocuments({ mode: 'course', courseId: course.id })
      .then(setExistingDocs)
      .catch(() => setExistingDocs([]))
  }, [course.id])

  const available = useMemo(
    () =>
      templates.filter((t) =>
        templateFits(t, {
          canHaveCourse: true,
          personType: peopleType,
          canPickPerson: people.length > 0 || t.person_role === 'none',
        }),
      ),
    [templates, peopleType, people.length],
  )

  const templateKey = available.map((t) => t.id).join('|')
  const peopleKey = people.map((p) => p.id).join('|')

  useEffect(() => {
    setTemplateIds(new Set(templateKey ? templateKey.split('|') : []))
  }, [templateKey])

  useEffect(() => {
    setPersonIds(new Set(peopleKey ? peopleKey.split('|') : []))
  }, [peopleKey])

  const selectedTemplates = available.filter((t) => templateIds.has(t.id))
  const selectedPeople = people.filter((p) => personIds.has(p.id))
  const needsPeople = selectedTemplates.some((t) => t.person_role !== 'none')

  const allJobs = useMemo(
    () =>
      buildBulkDocumentJobs({
        templates: selectedTemplates,
        people: selectedPeople,
        personType: peopleType,
      }),
    [selectedTemplates, selectedPeople, peopleType],
  )

  const jobs = useMemo(
    () =>
      filterBulkJobs({
        jobs: allJobs,
        course,
        existingDocs,
        skipExisting,
      }),
    [allJobs, course, existingDocs, skipExisting],
  )

  const skipped = allJobs.length - jobs.length

  async function handleGenerate() {
    if (selectedTemplates.length === 0) {
      setError('Seleziona almeno un modello')
      return
    }
    if (needsPeople && selectedPeople.length === 0) {
      setError(`Seleziona almeno un${peopleType === 'student' ? ' alunno' : 'a figura'}`)
      return
    }
    if (jobs.length === 0) {
      setError(
        skipExisting
          ? 'Niente da generare: i documenti selezionati esistono già.'
          : 'Niente da generare.',
      )
      return
    }

    if (
      !window.confirm(
        `Generare ${jobs.length} document${jobs.length === 1 ? 'o' : 'i'} per questo corso?`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setInfo('')
    setFailures([])
    setProgress(`0/${jobs.length}`)
    try {
      const result = await generateDocumentsBulk({
        course,
        jobs,
        onProgress: (done, total, item) => {
          setProgress(`${done}/${total} — ${item.templateName} · ${item.personName}`)
        },
      })
      const parts = [`${result.ok} creati`]
      if (skipped) parts.push(`${skipped} saltati`)
      if (result.failed) parts.push(`${result.failed} errori`)
      setInfo(`Completato: ${parts.join(', ')}.`)
      setFailures(
        result.items
          .filter((item) => item.status === 'error')
          .map((item) => `${item.templateName} · ${item.personName}: ${item.error}`),
      )
      if (result.ok > 0) {
        const docs = await listDocuments({ mode: 'course', courseId: course.id })
        setExistingDocs(docs)
        onGenerated?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generazione massiva fallita')
    } finally {
      setBusy(false)
      setProgress('')
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
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Genera in massa</h3>
      <p className="mb-3 text-xs text-slate-500">
        Crea gli stessi modelli per più {meta.title.toLowerCase()} del corso, senza
        ripeterli uno per uno.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">
              Modelli ({templateIds.size}/{available.length})
            </p>
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                className="px-2 py-1 text-xs"
                onClick={() => setTemplateIds(allIds(available))}
              >
                Tutti
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="px-2 py-1 text-xs"
                onClick={() => setTemplateIds(new Set())}
              >
                Nessuno
              </SecondaryButton>
            </div>
          </div>
          <IdCheckboxList
            items={available.map((t) => ({ id: t.id, label: t.name }))}
            selectedIds={templateIds}
            onToggle={(id) => setTemplateIds((cur) => toggleId(cur, id))}
            emptyText="Nessun modello."
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">
              Destinatari ({personIds.size}/{people.length})
            </p>
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                className="px-2 py-1 text-xs"
                onClick={() => setPersonIds(allIds(people))}
              >
                Tutti
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="px-2 py-1 text-xs"
                onClick={() => setPersonIds(new Set())}
              >
                Nessuno
              </SecondaryButton>
            </div>
          </div>
          <IdCheckboxList
            items={people.map((p) => ({ id: p.id, label: fullName(p) }))}
            selectedIds={personIds}
            onToggle={(id) => setPersonIds((cur) => toggleId(cur, id))}
            emptyText={`Nessun${peopleType === 'student' ? ' alunno iscritto' : 'a figura assegnata'}.`}
          />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={skipExisting}
          onChange={(e) => setSkipExisting(e.target.checked)}
        />
        Salta chi ha già lo stesso modello per questo corso
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" disabled={busy} onClick={() => void handleGenerate()}>
          {busy
            ? `Generazione… ${progress}`
            : jobs.length === 0
              ? 'Genera documenti'
              : `Genera ${jobs.length} document${jobs.length === 1 ? 'o' : 'i'}`}
        </PrimaryButton>
        {!busy && skipped > 0 && (
          <span className="text-xs text-slate-500">{skipped} già presenti, verranno saltati</span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-3 text-sm text-emerald-600">{info}</p>}
      {failures.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-600">
          {failures.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
