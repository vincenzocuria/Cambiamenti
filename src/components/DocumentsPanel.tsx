import { useEffect, useRef, useState } from 'react'
import type { Course, DocumentCategory, DocumentRow, PersonType } from '../types/db'
import {
  deleteDocument,
  getDownloadUrl,
  listDocuments,
  uploadDocument,
  type DocumentFilter,
} from '../services/documents'
import { listPersonCourses } from '../services/enrollments'
import { listCourses } from '../services/courses'
import { categoryLabels, categoryOptions } from '../data/documentCategories'
import { documentPersonType, isStaffType } from '../data/personTypes'
import { fmtBytes, fmtDate } from '../lib/format'
import { DangerButton, PrimaryButton } from './Buttons'
import { SelectField, TextField } from './Field'
import { tableClass, tdCompactClass, thCompactClass, theadRowClass, trClass } from '../lib/tableStyles'

export type DocumentsPanelProps =
  | { mode: 'person'; personType: PersonType; personId: string }
  | { mode: 'course'; courseId: string; personNames?: Record<string, string> }

function toFilter(props: DocumentsPanelProps): DocumentFilter {
  return props.mode === 'person'
    ? {
        mode: 'person',
        personType: documentPersonType(props.personType),
        personId: props.personId,
      }
    : { mode: 'course', courseId: props.courseId }
}

export function DocumentsPanel(props: DocumentsPanelProps) {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [category, setCategory] = useState<DocumentCategory>(() => {
    if (props.mode === 'course') return 'module'
    return isStaffType(props.personType) ? 'curriculum' : 'identity'
  })
  const [courseId, setCourseId] = useState(props.mode === 'course' ? props.courseId : '')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function reload() {
    setDocs(await listDocuments(toFilter(props)))
  }

  useEffect(() => {
    void reload()
    if (props.mode === 'person') {
      listPersonCourses(props.personType, props.personId).then(setCourses)
    } else {
      listCourses().then(setCourses)
      setCourseId(props.courseId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.mode === 'person' ? props.personId : props.courseId])

  const needsCourseLink = category === 'module' || category === 'appointment'

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Seleziona un file da caricare')
      return
    }
    setBusy(true)
    setError('')
    try {
      const linkedCourse =
        props.mode === 'course'
          ? props.courseId
          : needsCourseLink && courseId
            ? courseId
            : null

      await uploadDocument({
        personType: props.mode === 'person' ? documentPersonType(props.personType) : null,
        personId: props.mode === 'person' ? props.personId : null,
        courseId: linkedCourse,
        category,
        title: title || (category === 'curriculum' ? 'Curriculum' : ''),
        file,
      })
      if (fileRef.current) fileRef.current.value = ''
      setTitle('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(doc: DocumentRow) {
    window.open(await getDownloadUrl(doc), '_blank')
  }

  async function handleDelete(doc: DocumentRow) {
    if (!window.confirm(`Eliminare "${doc.file_name}"?`)) return
    await deleteDocument(doc)
    await reload()
  }

  function courseName(id: string | null): string {
    if (!id) return '—'
    const c = courses.find((c) => c.id === id)
    return c ? `${c.name} ${c.edition}`.trim() : '—'
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Documenti allegati</h3>

      <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory)}
        >
          {categoryOptions
            .filter((o) => {
              if (o.value === 'generated') return false
              if (o.value === 'curriculum' && props.mode === 'course') return false
              return true
            })
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </SelectField>

        {props.mode === 'person' && needsCourseLink && (
          <SelectField
            label="Corso collegato (opzionale)"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">— nessuno —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.edition}
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          label="Titolo (opzionale)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Es. CI fronte/retro"
        />

        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">File</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.html"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </label>

        <PrimaryButton type="button" onClick={() => void handleUpload()} disabled={busy}>
          {busy ? 'Caricamento…' : 'Carica'}
        </PrimaryButton>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun documento caricato.</p>
      ) : (
        <table className={tableClass}>
          <thead>
            <tr className={theadRowClass}>
              <th className={thCompactClass}>File</th>
              <th className={thCompactClass}>Categoria</th>
              {props.mode === 'course' && <th className={thCompactClass}>Persona</th>}
              {props.mode === 'person' && <th className={thCompactClass}>Corso</th>}
              <th className={thCompactClass}>Dimensione</th>
              <th className={thCompactClass}>Data</th>
              <th className={thCompactClass}></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className={trClass}>
                <td className={tdCompactClass}>
                  <button
                    onClick={() => void handleDownload(d)}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {d.title || d.file_name}
                  </button>
                </td>
                <td className={tdCompactClass}>{categoryLabels[d.category] ?? d.category}</td>
                {props.mode === 'course' && (
                  <td className={`${tdCompactClass} text-slate-500`}>
                    {d.person_id && props.personNames?.[d.person_id]
                      ? props.personNames[d.person_id]
                      : d.person_type === 'student'
                        ? 'Alunno'
                        : d.person_type === 'staff' ||
                            d.person_type === 'teacher' ||
                            d.person_type === 'tutor' ||
                            d.person_type === 'admin_staff'
                          ? 'Personale'
                          : '—'}
                  </td>
                )}
                {props.mode === 'person' && (
                  <td className={tdCompactClass}>{courseName(d.course_id)}</td>
                )}
                <td className={tdCompactClass}>{fmtBytes(d.size_bytes)}</td>
                <td className={`${tdCompactClass} whitespace-nowrap tabular-nums`}>
                  {fmtDate(d.created_at)}
                </td>
                <td className={`${tdCompactClass} text-right`}>
                  <DangerButton onClick={() => void handleDelete(d)}>Elimina</DangerButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
