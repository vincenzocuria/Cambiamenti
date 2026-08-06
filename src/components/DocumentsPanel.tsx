import { useEffect, useRef, useState } from 'react'
import type { Course, DocumentCategory, DocumentRow, PersonType } from '../types/db'
import { deleteDocument, getDownloadUrl, listDocuments, uploadDocument } from '../services/documents'
import { listPersonCourses } from '../services/enrollments'
import { fmtBytes, fmtDate } from '../lib/format'
import { DangerButton, PrimaryButton } from './Buttons'
import { SelectField } from './Field'

const categoryLabels: Record<DocumentCategory, string> = {
  identity: "Documento d'identità",
  module: 'Modulo corso',
  other: 'Altro',
}

interface Props {
  personType: PersonType
  personId: string
}

export function DocumentsPanel({ personType, personId }: Props) {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [category, setCategory] = useState<DocumentCategory>('identity')
  const [courseId, setCourseId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function reload() {
    setDocs(await listDocuments(personType, personId))
  }

  useEffect(() => {
    void reload()
    listPersonCourses(personType, personId).then(setCourses)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personType, personId])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Seleziona un file da caricare')
      return
    }
    setBusy(true)
    setError('')
    try {
      await uploadDocument({
        personType,
        personId,
        courseId: category === 'module' && courseId ? courseId : null,
        category,
        file,
      })
      if (fileRef.current) fileRef.current.value = ''
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(doc: DocumentRow) {
    const url = await getDownloadUrl(doc)
    window.open(url, '_blank')
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

      <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
        <SelectField
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory)}
        >
          <option value="identity">Documento d'identità</option>
          <option value="module">Modulo corso</option>
          <option value="other">Altro</option>
        </SelectField>
        {category === 'module' && (
          <SelectField label="Corso associato" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">— nessuno —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.edition}
              </option>
            ))}
          </SelectField>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">File (PDF/Word/immagine)</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </label>
        <PrimaryButton type="button" onClick={handleUpload} disabled={busy}>
          {busy ? 'Caricamento…' : 'Carica'}
        </PrimaryButton>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun documento caricato.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">File</th>
              <th>Categoria</th>
              <th>Corso</th>
              <th>Dimensione</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="py-2">
                  <button
                    onClick={() => void handleDownload(d)}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {d.file_name}
                  </button>
                </td>
                <td>{categoryLabels[d.category]}</td>
                <td>{courseName(d.course_id)}</td>
                <td>{fmtBytes(d.size_bytes)}</td>
                <td>{fmtDate(d.created_at)}</td>
                <td className="text-right">
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
