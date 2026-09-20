import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Person, PersonInput, PersonType } from '../types/db'
import { createPerson, listPeople } from '../services/people'
import { metaFor } from '../data/personTypes'
import { inpsBenefitLabel } from '../data/inpsBenefits'
import { fmtDate, fullName } from '../lib/format'
import { hasCompleteFadCredentials } from '../lib/fadCredentials'
import { matchesSearch } from '../lib/matchesSearch'
import { describeFilters, exportFilteredList } from '../lib/listExport'
import {
  countPersonStatus,
  isPersonListStatus,
  matchesPersonStatus,
} from '../lib/personListStatus'
import { useListQuery } from '../hooks/useListQuery'
import { EmailLink, WhatsAppLink } from '../components/ContactLinks'
import { PersonForm } from '../components/PersonForm'
import { PrimaryButton } from '../components/Buttons'
import { KpiCards } from '../components/KpiCards'
import { StatusFilterCards } from '../components/StatusFilterCards'
import { ListToolbar } from '../components/ListToolbar'
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

function fadBadge(person: Person) {
  return hasCompleteFadCredentials(person) ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      OK
    </span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
      Da compilare
    </span>
  )
}

export function PeopleListPage({ type }: Props) {
  const [people, setPeople] = useState<Person[]>([])
  const [creating, setCreating] = useState(false)
  const { search, status: rawStatus, setSearch, setStatus } = useListQuery()
  const status = isPersonListStatus(rawStatus) ? rawStatus : ''
  const l = metaFor(type)
  const isStudent = type === 'student'

  async function reload() {
    setPeople(await listPeople(type))
  }

  useEffect(() => {
    setCreating(false)
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  async function handleCreate(input: PersonInput) {
    await createPerson(type, input)
    setCreating(false)
    await reload()
  }

  const searched = useMemo(
    () =>
      people.filter((p) =>
        matchesSearch(
          `${p.first_name} ${p.last_name} ${p.tax_code} ${p.email} ${p.fad_email}`,
          search,
        ),
      ),
    [people, search],
  )

  const filtered = useMemo(
    () => searched.filter((p) => matchesPersonStatus(p, status)),
    [searched, status],
  )

  const fadOk = countPersonStatus(people, 'fad_ok')
  const fadMissing = countPersonStatus(people, 'fad_da_compilare')
  const noEmail = countPersonStatus(people, 'senza_email')
  const withInps = countPersonStatus(people, 'con_inps')

  const statusLabel =
    status === 'fad_ok'
      ? 'FAD OK'
      : status === 'fad_da_compilare'
        ? 'FAD da compilare'
        : status === 'senza_email'
          ? 'Senza email'
          : status === 'con_inps'
            ? 'Con prestazione INPS'
            : ''

  function toggleStatus(key: string) {
    setStatus(status === key ? '' : key)
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: l.title,
      rows: filtered,
      format,
      filters: describeFilters([statusLabel, search && `ricerca «${search}»`]),
      columns: [
        { header: 'Nominativo', value: (p) => fullName(p) },
        { header: 'Codice fiscale', value: (p) => p.tax_code || '' },
        { header: 'Nato/a il', value: (p) => fmtDate(p.birth_date) },
        { header: 'Email', value: (p) => p.email || '' },
        { header: 'FAD', value: (p) => (hasCompleteFadCredentials(p) ? 'OK' : 'Da compilare') },
        { header: 'Telefono', value: (p) => p.phone || '' },
        { header: 'Città', value: (p) => p.city || '' },
        ...(isStudent
          ? [{ header: 'INPS', value: (p: Person) => inpsBenefitLabel(p.inps_benefit) || '—' }]
          : []),
      ],
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{l.title}</h1>
        {!creating && (
          <PrimaryButton onClick={() => setCreating(true)}>+ Nuovo {l.singular}</PrimaryButton>
        )}
      </div>

      <KpiCards
        items={[
          {
            key: 'totale',
            label: `Totale ${l.title.toLowerCase()}`,
            hint: 'In anagrafica',
            value: people.length,
            active: !status,
            onClick: () => setStatus(''),
          },
          {
            key: 'fad_ok',
            label: 'FAD completa',
            hint: 'Email e password',
            value: fadOk,
            tone: 'ok',
            active: status === 'fad_ok',
            onClick: () => toggleStatus('fad_ok'),
          },
          {
            key: 'fad_da_compilare',
            label: 'FAD da compilare',
            hint: 'Credenziali incomplete',
            value: fadMissing,
            tone: fadMissing > 0 ? 'warn' : 'ok',
            active: status === 'fad_da_compilare',
            onClick: () => toggleStatus('fad_da_compilare'),
          },
          isStudent
            ? {
                key: 'con_inps',
                label: 'Con prestazione INPS',
                hint: 'NASpI, ADI, SFL o CIG',
                value: withInps,
                active: status === 'con_inps',
                onClick: () => toggleStatus('con_inps'),
              }
            : {
                key: 'senza_email',
                label: 'Senza email',
                hint: 'Contatto mancante',
                value: noEmail,
                tone: noEmail > 0 ? 'warn' : 'ok',
                active: status === 'senza_email',
                onClick: () => toggleStatus('senza_email'),
              },
        ]}
      />

      <StatusFilterCards
        allCount={people.length}
        value={status}
        onChange={setStatus}
        items={[
          { key: 'fad_ok', label: 'FAD OK', count: fadOk, tone: 'ok' },
          {
            key: 'fad_da_compilare',
            label: 'Da compilare',
            count: fadMissing,
            tone: fadMissing > 0 ? 'warn' : 'ok',
          },
          isStudent
            ? { key: 'con_inps', label: 'Con INPS', count: withInps, tone: 'info' }
            : {
                key: 'senza_email',
                label: 'Senza email',
                count: noEmail,
                tone: noEmail > 0 ? 'warn' : 'default',
              },
        ]}
      />

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

      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Cerca per nome, codice fiscale o email…"
        resultCount={filtered.length}
        totalCount={people.length}
        unitSingular={l.singular}
        unitPlural={l.title.toLowerCase()}
        onExportExcel={() => exportList('excel')}
        onExportPdf={() => exportList('pdf')}
      />

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
              {isStudent && <th className={thClass}>INPS</th>}
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
                <td className={tdClass}>{fadBadge(p)}</td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  <WhatsAppLink value={p.phone} />
                </td>
                <td className={tdClass}>{p.city || '—'}</td>
                {isStudent && (
                  <td className={tdClass}>{inpsBenefitLabel(p.inps_benefit) || '—'}</td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isStudent ? 8 : 7}
                  className={`${tdClass} py-10 text-center text-slate-400`}
                >
                  {people.length === 0
                    ? `Nessun ${l.singular} in anagrafica.`
                    : 'Nessun risultato per i filtri selezionati.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
