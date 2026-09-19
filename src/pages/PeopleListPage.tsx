import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Person, PersonInput, PersonType } from '../types/db'
import { createPerson, listPeople } from '../services/people'
import { metaFor } from '../data/personTypes'
import { fmtDate, fullName } from '../lib/format'
import { hasCompleteFadCredentials } from '../lib/fadCredentials'
import { EmailLink, WhatsAppLink } from '../components/ContactLinks'
import { PersonForm } from '../components/PersonForm'
import { PrimaryButton } from '../components/Buttons'
import {
  tableWideClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadRowClass,
  trClass,
} from '../lib/tableStyles'

interface Props {
  type: PersonType
}

export function PeopleListPage({ type }: Props) {
  const [people, setPeople] = useState<Person[]>([])
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const l = metaFor(type)

  async function reload() {
    setPeople(await listPeople(type))
  }

  useEffect(() => {
    setCreating(false)
    setSearch('')
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  async function handleCreate(input: PersonInput) {
    await createPerson(type, input)
    setCreating(false)
    await reload()
  }

  const filtered = people.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.tax_code} ${p.email} ${p.fad_email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{l.title}</h1>
        {!creating && (
          <PrimaryButton onClick={() => setCreating(true)}>+ Nuovo {l.singular}</PrimaryButton>
        )}
      </div>

      {creating && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold capitalize text-slate-700">
            Nuovo {l.singular}
          </h2>
          <PersonForm
            personType={type}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Cerca per nome, codice fiscale o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />
        <p className="text-xs text-slate-500">
          {filtered.length === people.length
            ? `${people.length} ${people.length === 1 ? l.singular : l.title.toLowerCase()}`
            : `${filtered.length} di ${people.length}`}
        </p>
      </div>

      <div className={tableWrapClass}>
        <table className={tableWideClass}>
          <thead>
            <tr className={theadRowClass}>
              <th className={thClass}>Nominativo</th>
              <th className={thClass}>Codice fiscale</th>
              <th className={thClass}>Nato/a il</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>FAD</th>
              <th className={thClass}>Telefono</th>
              <th className={thClass}>Città</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={trClass}>
                <td className={tdClass}>
                  <Link
                    to={`${l.basePath}/${p.id}`}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {fullName(p)}
                  </Link>
                </td>
                <td className={`${tdClass} font-mono text-xs tracking-wide`}>
                  {p.tax_code || '—'}
                </td>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  {fmtDate(p.birth_date)}
                </td>
                <td className={`${tdClass} break-all`}>
                  <EmailLink value={p.email} />
                </td>
                <td className={tdClass}>
                  {hasCompleteFadCredentials(p) ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      OK
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Da compilare
                    </span>
                  )}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  <WhatsAppLink value={p.phone} />
                </td>
                <td className={tdClass}>{p.city || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className={`${tdClass} py-10 text-center text-slate-400`}>
                  {people.length === 0
                    ? `Nessun ${l.singular} in anagrafica.`
                    : 'Nessun risultato per la ricerca.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
