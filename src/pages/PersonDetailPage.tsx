import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Course, Person, PersonInput, PersonType } from '../types/db'
import { deletePerson, getPerson, updatePerson } from '../services/people'
import { listPersonCourses } from '../services/enrollments'
import { fmtDate, fullName } from '../lib/format'
import { PersonForm } from '../components/PersonForm'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { DangerButton, SecondaryButton } from '../components/Buttons'

interface Props {
  type: PersonType
}

const labels: Record<PersonType, { basePath: string; back: string; deleteMsg: string }> = {
  student: { basePath: '/alunni', back: '← Tutti gli alunni', deleteMsg: "Eliminare quest'alunno?" },
  teacher: { basePath: '/docenti', back: '← Tutti i docenti', deleteMsg: 'Eliminare questo docente?' },
}

export function PersonDetailPage({ type }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [person, setPerson] = useState<Person | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [editing, setEditing] = useState(false)
  const l = labels[type]

  useEffect(() => {
    if (id) {
      getPerson(type, id).then(setPerson)
      listPersonCourses(type, id).then(setCourses)
    }
  }, [id, type])

  if (!id || !person) return <p className="text-slate-400">Caricamento…</p>

  async function handleSave(input: PersonInput) {
    const updated = await updatePerson(type, id!, input)
    setPerson(updated)
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm(`${l.deleteMsg} Verranno rimossi anche iscrizioni e riferimenti ai documenti.`)) return
    await deletePerson(type, id!)
    navigate(l.basePath)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={l.basePath} className="text-xs text-indigo-600 hover:underline">
            {l.back}
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{fullName(person)}</h1>
        </div>
        <div className="flex gap-2">
          {!editing && <SecondaryButton onClick={() => setEditing(true)}>Modifica</SecondaryButton>}
          <DangerButton onClick={() => void handleDelete()}>Elimina</DangerButton>
        </div>
      </div>

      {editing ? (
        <PersonForm initial={person} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <div className="space-y-4">
          <InfoCard title="Anagrafica">
            <Info label="Codice fiscale" value={person.tax_code} />
            <Info label="Nato/a" value={`${fmtDate(person.birth_date)} ${person.birth_place ? `a ${person.birth_place}` : ''}`} />
            <Info label="Sesso" value={person.gender} />
            <Info label="Indirizzo" value={[person.address, person.postal_code, person.city, person.province].filter(Boolean).join(', ')} />
            <Info label="Telefono" value={person.phone} />
            <Info label="Email" value={person.email} />
          </InfoCard>
          <InfoCard title="Coordinate bancarie">
            <Info label="IBAN" value={person.iban} mono />
            <Info label="Banca" value={person.bank_name} />
            <Info label="BIC / SWIFT" value={person.bic} mono />
          </InfoCard>
          <InfoCard title="Documento d'identità">
            <Info label="Tipo" value={person.doc_type} />
            <Info label="Numero" value={person.doc_number} />
            <Info label="Rilasciato da" value={person.doc_issued_by} />
            <Info label="Rilascio" value={fmtDate(person.doc_issue_date)} />
            <Info label="Scadenza" value={fmtDate(person.doc_expiry_date)} />
          </InfoCard>
          {person.notes && (
            <InfoCard title="Note">
              <p className="col-span-full text-sm text-slate-600">{person.notes}</p>
            </InfoCard>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Corsi associati ({courses.length})</h3>
        {courses.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nessun corso associato. Puoi associarlo dalla pagina di dettaglio del corso.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {courses.map((c) => (
              <li key={c.id} className="py-2">
                <Link to={`/corsi/${c.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                  {c.name} {c.edition && `· ${c.edition}`}
                </Link>
                <span className="ml-2 text-xs text-slate-400">
                  {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DocumentsPanel personType={type} personId={id} />
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-medium text-slate-700 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )
}
