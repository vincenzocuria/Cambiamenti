import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Course, Person, PersonInput, PersonType } from '../types/db'
import { deletePerson, getPerson, listStaffRoles, updatePerson } from '../services/people'
import { listPersonCourses } from '../services/enrollments'
import { isStaffType, metaFor } from '../data/personTypes'
import { fmtDate, fullName } from '../lib/format'
import { PersonForm } from '../components/PersonForm'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { GenerateDocumentForm } from '../components/GenerateDocumentForm'
import { DangerButton, SecondaryButton } from '../components/Buttons'
import { SecretValue } from '../components/SecretValue'
import { hasCompleteFadCredentials } from '../lib/fadCredentials'

interface Props {
  type: PersonType
}

const roleLabels: Record<string, string> = {
  teacher: 'Docente',
  tutor: 'Tutor',
  admin_staff: 'Amministrativo',
}

export function PersonDetailPage({ type }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [person, setPerson] = useState<Person | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [roleRows, setRoleRows] = useState<
    { course_id: string; role: string; course_name: string; course_edition: string }[]
  >([])
  const [editing, setEditing] = useState(false)
  const [docsKey, setDocsKey] = useState(0)
  const registryType: PersonType = isStaffType(type) ? 'staff' : type
  const meta = metaFor(registryType)

  useEffect(() => {
    if (!id) return
    getPerson(registryType, id).then(setPerson)
    listPersonCourses(registryType, id).then(setCourses)
    if (isStaffType(type)) {
      listStaffRoles(id).then(setRoleRows)
    } else {
      setRoleRows([])
    }
  }, [id, type, registryType])

  if (!id || !person) return <p className="text-slate-400">Caricamento…</p>

  async function handleSave(input: PersonInput) {
    const updated = await updatePerson(registryType, id!, input)
    setPerson(updated)
    setEditing(false)
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Eliminare questa ${meta.singular}? Verranno rimosse anche le associazioni ai corsi.`,
      )
    )
      return
    await deletePerson(registryType, id!)
    navigate(meta.basePath)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={meta.basePath} className="text-xs text-indigo-600 hover:underline">
            ← {meta.title}
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{fullName(person)}</h1>
          {isStaffType(type) && roleRows.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1 text-xs">
              {[...new Set(roleRows.map((r) => r.role))].map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700"
                >
                  {roleLabels[role] ?? role}
                </span>
              ))}
            </p>
          )}
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
            <Info
              label="Nato/a"
              value={`${fmtDate(person.birth_date)} ${person.birth_place ? `a ${person.birth_place}` : ''}`}
            />
            <Info label="Sesso" value={person.gender} />
            <Info
              label="Indirizzo"
              value={[person.address, person.postal_code, person.city, person.province]
                .filter(Boolean)
                .join(', ')}
            />
            <Info label="Telefono" value={person.phone} />
            <Info label="Email" value={person.email} />
          </InfoCard>
          <InfoCard title="Credenziali FAD">
            <Info
              label="Email FAD"
              value={
                person.fad_email ||
                (person.email ? `${person.email} (anagrafica)` : '')
              }
            />
            <div>
              <p className="text-xs text-slate-400">Password FAD</p>
              <SecretValue value={person.fad_password} />
            </div>
            {!hasCompleteFadCredentials(person) && (
              <p className="col-span-full text-xs text-amber-700">
                Credenziali FAD incomplete. Usa Modifica per aggiungere email e password FAD.
              </p>
            )}
          </InfoCard>
          <InfoCard title="Coordinate bancarie">
            <Info label="IBAN" value={person.iban} mono />
            <Info label="Banca" value={person.bank_name} />
            <Info label="BIC / SWIFT" value={person.bic} mono />
          </InfoCard>
          <InfoCard title="Documento d'identità (dati)">
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
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Corsi e ruoli ({isStaffType(type) ? roleRows.length : courses.length})
        </h3>
        {isStaffType(type) ? (
          roleRows.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nessun incarico. Associala a un corso come docente, tutor o amministrativo.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {roleRows.map((r) => (
                <li key={`${r.course_id}-${r.role}`} className="flex items-center justify-between py-2">
                  <Link
                    to={`/corsi/${r.course_id}`}
                    className="text-sm font-medium text-indigo-600 hover:underline"
                  >
                    {r.course_name} {r.course_edition && `· ${r.course_edition}`}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {roleLabels[r.role] ?? r.role}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : courses.length === 0 ? (
          <p className="text-sm text-slate-400">Nessun corso associato.</p>
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

      <GenerateDocumentForm
        person={person}
        personType={registryType === 'staff' ? 'staff' : type}
        courses={courses}
        onGenerated={() => setDocsKey((n) => n + 1)}
      />

      {isStaffType(type) && (
        <p className="text-sm text-slate-500">
          Carica il <strong>curriculum</strong> e gli altri documenti della figura qui sotto
          (categoria Curriculum). I dati anagrafici restano unici anche se ha più ruoli nei corsi.
        </p>
      )}

      <DocumentsPanel key={docsKey} mode="person" personType={registryType} personId={id} />
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
      <p className={`text-sm font-medium text-slate-700 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}
