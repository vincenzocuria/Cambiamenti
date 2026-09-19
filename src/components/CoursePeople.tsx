import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Person, PersonInput, PersonType } from '../types/db'
import { addToCourse, listCoursePeople, removeFromCourse } from '../services/enrollments'
import { createPerson, listPeople } from '../services/people'
import { isStaffType, metaFor } from '../data/personTypes'
import { fullName } from '../lib/format'
import { DangerButton, SecondaryButton } from './Buttons'
import { EmailLink, WhatsAppLink } from './ContactLinks'
import { PersonForm } from './PersonForm'

interface Props {
  courseId: string
  type: PersonType
  /** Personale già assegnato a un qualsiasi ruolo sul corso. */
  takenPersonIds?: string[]
  onChanged?: () => void
}

export function CoursePeople({ courseId, type, takenPersonIds, onChanged }: Props) {
  const [enrolled, setEnrolled] = useState<Person[]>([])
  const [all, setAll] = useState<Person[]>([])
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const meta = metaFor(type)

  async function reload() {
    setEnrolled(await listCoursePeople(type, courseId))
  }

  useEffect(() => {
    void reload()
    // Pool condiviso per tutto il personale
    listPeople(isStaffType(type) ? 'staff' : type).then(setAll)
    setCreating(false)
    setSelected('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, type])

  const taken = new Set(takenPersonIds ?? [])
  const available = all.filter((p) => {
    if (enrolled.some((e) => e.id === p.id)) return false
    if (isStaffType(type) && taken.has(p.id)) return false
    return true
  })

  async function handleAdd() {
    if (!selected) return
    setError('')
    try {
      await addToCourse(type, courseId, selected)
      setSelected('')
      await reload()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Associazione fallita')
    }
  }

  async function handleRemove(personId: string) {
    if (meta.courseMin > 0 && enrolled.length <= meta.courseMin) {
      setError(`Serve almeno ${meta.courseMin} ${meta.singular}: non puoi scendere sotto il minimo.`)
      return
    }
    setError('')
    await removeFromCourse(type, courseId, personId)
    await reload()
    onChanged?.()
  }

  async function handleCreate(input: PersonInput) {
    setError('')
    try {
      const created = await createPerson(isStaffType(type) ? 'staff' : type, input)
      await addToCourse(type, courseId, created.id)
      setCreating(false)
      setAll(await listPeople(isStaffType(type) ? 'staff' : type))
      await reload()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione fallita')
    }
  }

  const belowMin = meta.courseMin > 0 && enrolled.length < meta.courseMin

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            {meta.title} ({enrolled.length}
            {meta.courseMin > 0 ? ` / min. ${meta.courseMin}` : ''})
          </h3>
          {belowMin && (
            <p className="text-xs text-amber-700">
              Mancano ancora {meta.courseMin - enrolled.length}
            </p>
          )}
          {isStaffType(type) && (
            <p className="text-xs text-slate-400">
              Stessa anagrafica del personale: su questo corso ogni figura ha un solo ruolo.
            </p>
          )}
        </div>
        <SecondaryButton type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Chiudi' : '+ Crea nuovo'}
        </SecondaryButton>
      </div>

      {creating && (
        <div className="mb-4 rounded-lg border border-indigo-100 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Nuova figura (verrà associata a questo corso come {meta.singular})
          </p>
          <PersonForm
            personType={isStaffType(type) ? 'staff' : type}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">— seleziona dal personale —</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {fullName(p)} {p.tax_code ? `(${p.tax_code})` : ''}
            </option>
          ))}
        </select>
        <SecondaryButton onClick={() => void handleAdd()} disabled={!selected}>
          Associa come {meta.singular}
        </SecondaryButton>
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {enrolled.length === 0 ? (
        <p className="text-sm text-slate-400">Nessuno associato in questo ruolo.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {enrolled.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <Link
                  to={`${meta.basePath}/${p.id}`}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  {fullName(p)}
                </Link>
                {(p.phone || p.email) && (
                  <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {p.phone ? <WhatsAppLink value={p.phone} className="text-xs" /> : null}
                    {p.email ? <EmailLink value={p.email} className="text-xs" /> : null}
                  </p>
                )}
              </div>
              <DangerButton onClick={() => void handleRemove(p.id)}>Rimuovi</DangerButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
