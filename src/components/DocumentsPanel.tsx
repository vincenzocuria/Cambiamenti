import { useEffect, useMemo, useRef, useState } from 'react'
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
import { DOCUMENT_FILE_ACCEPT, formatDocumentUploadError } from '../lib/documentFileTypes'
import {
  browseDocuments,
  DEFAULT_DOCUMENT_SORT,
  DEFAULT_DOCUMENT_SORT_DIR,
  documentSortKeys,
  documentSortLabel,
  type DocumentSortDir,
  type DocumentSortKey,
} from '../lib/documentListBrowse'
import { documentPersonType, isStaffType } from '../data/personTypes'
import { fmtBytes, fmtDate } from '../lib/format'
import { DangerButton, PrimaryButton } from './Buttons'
import { fieldInputClass, SelectField, TextField } from './Field'
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

const fileInputClass =
  'block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100'

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
  const [errors, setErrors] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<DocumentSortKey>(DEFAULT_DOCUMENT_SORT)
  const [sortDir, setSortDir] = useState<DocumentSortDir>(DEFAULT_DOCUMENT_SORT_DIR)
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

  function resolveCourseName(id: string | null): string {
    if (!id) return ''
    const c = courses.find((item) => item.id === id)
    return c ? `${c.name} ${c.edition}`.trim() : ''
  }

  function resolvePersonLabel(doc: DocumentRow): string {
    if (props.mode !== 'course' || !doc.person_id) return ''
    return props.personNames?.[doc.person_id] ?? ''
  }

  const visibleDocs = useMemo(
    () =>
      browseDocuments(docs, search, sortKey, sortDir, {
        personLabel: resolvePersonLabel,
        courseLabel: (doc) => resolveCourseName(doc.course_id),
      }),
    [docs, search, sortKey, sortDir, courses, props],
  )

  async function handleUpload() {
    const files = Array.from(fileRef.current?.files ?? [])
    if (files.length === 0) {
      setErrors(['Seleziona un file da caricare'])
      return
    }
    setBusy(true)
    setErrors([])
    const failures: string[] = []
    try {
      const linkedCourse =
        props.mode === 'course'
          ? props.courseId
          : needsCourseLink && courseId
            ? courseId
            : null

      for (const file of files) {
        const fileTitle =
          files.length === 1
            ? title || (category === 'curriculum' ? 'Curriculum' : '')
            : title
              ? `${title} — ${file.name}`
              : ''
        try {
          await uploadDocument({
            personType: props.mode === 'person' ? documentPersonType(props.personType) : null,
            personId: props.mode === 'person' ? props.personId : null,
            courseId: linkedCourse,
            category,
            title: fileTitle,
            file,
          })
        } catch (err) {
          failures.push(
            err instanceof Error ? err.message : formatDocumentUploadError(err, file.name),
          )
        }
      }
      if (failures.length < files.length) {
        if (fileRef.current) fileRef.current.value = ''
        setTitle('')
      }
      await reload()
      if (failures.length) setErrors(failures)
    } catch (err) {
      setErrors([
        err instanceof Error ? err.message : 'Errore durante il caricamento',
      ])
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

  function personCell(doc: DocumentRow): string {
    const named = resolvePersonLabel(doc)
    if (named) return named
    if (doc.person_type === 'student') return 'Alunno'
    if (
      doc.person_type === 'staff' ||
      doc.person_type === 'teacher' ||
      doc.person_type === 'tutor' ||
      doc.person_type === 'admin_staff'
    ) {
      return 'Personale'
    }
    return '—'
  }

  const countLabel =
    docs.length === visibleDocs.length
      ? `${docs.length} file`
      : `${visibleDocs.length} di ${docs.length}`

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">Documenti allegati</h3>

      <div className="mb-4 space-y-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
        <div
          className={`grid grid-cols-1 gap-3 ${needsCourseLink && props.mode === 'person' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}
        >
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
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">File</span>
            <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={DOCUMENT_FILE_ACCEPT}
                className={fileInputClass}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              PDF, Word, Excel, ZIP, RAR, file firmati (.p7m, .p7s), immagini o testo. Puoi
              selezionare più file.
            </p>
          </label>
          <PrimaryButton
            type="button"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => void handleUpload()}
            disabled={busy}
          >
            {busy ? 'Caricamento…' : 'Carica'}
          </PrimaryButton>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <p className="font-medium">Caricamento non riuscito</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun documento caricato.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per nome file, titolo o categoria…"
              className={`${fieldInputClass} min-w-[12rem] flex-1`}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="whitespace-nowrap">Ordina per</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as DocumentSortKey)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                {documentSortKeys.map((key) => (
                  <option key={key} value={key}>
                    {documentSortLabel(key)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={sortDir === 'asc' ? 'Ordine crescente' : 'Ordine decrescente'}
              >
                {sortKey === 'date' || sortKey === 'size'
                  ? sortDir === 'asc'
                    ? '↑'
                    : '↓'
                  : sortDir === 'asc'
                    ? 'A→Z'
                    : 'Z→A'}
              </button>
            </label>
            <span className="text-xs text-slate-400">{countLabel}</span>
          </div>

          <div className="overflow-x-auto">
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
                {visibleDocs.map((d) => (
                  <tr key={d.id} className={trClass}>
                    <td className={tdCompactClass}>
                      <button
                        type="button"
                        onClick={() => void handleDownload(d)}
                        className="max-w-[16rem] truncate text-left font-medium text-indigo-600 hover:underline sm:max-w-xs"
                        title={d.file_name}
                      >
                        {d.title || d.file_name}
                      </button>
                    </td>
                    <td className={tdCompactClass}>{categoryLabels[d.category] ?? d.category}</td>
                    {props.mode === 'course' && (
                      <td className={`${tdCompactClass} text-slate-500`}>{personCell(d)}</td>
                    )}
                    {props.mode === 'person' && (
                      <td className={tdCompactClass}>
                        {resolveCourseName(d.course_id) || '—'}
                      </td>
                    )}
                    <td className={`${tdCompactClass} whitespace-nowrap tabular-nums`}>
                      {fmtBytes(d.size_bytes)}
                    </td>
                    <td className={`${tdCompactClass} whitespace-nowrap tabular-nums`}>
                      {fmtDate(d.created_at)}
                    </td>
                    <td className={`${tdCompactClass} text-right`}>
                      <DangerButton onClick={() => void handleDelete(d)}>Elimina</DangerButton>
                    </td>
                  </tr>
                ))}
                {visibleDocs.length === 0 && (
                  <tr>
                    <td
                      colSpan={props.mode === 'course' ? 7 : 6}
                      className={`${tdCompactClass} py-8 text-center text-slate-400`}
                    >
                      Nessun risultato per la ricerca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
