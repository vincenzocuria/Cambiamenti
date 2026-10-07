import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Person, PersonInput, PersonType } from '../types/db'
import { createPerson, listPeople } from '../services/people'
import { listStudentIdsWithIdentityFile } from '../services/documents'
import { listStudentCourseMap } from '../services/enrollments'
import { metaFor } from '../data/personTypes'
import { inpsBenefitLabel } from '../data/inpsBenefits'
import { fmtDate, fullName } from '../lib/format'
import { hasCompleteFadCredentials } from '../lib/fadCredentials'
import { matchesSearch } from '../lib/matchesSearch'
import { describeFilters, exportFilteredList } from '../lib/listExport'
import { countPersonStatuses, isPersonListStatus, matchesPersonStatus } from '../lib/personListStatus'
import { checkStudentDocuments, studentDocumentExportValue } from '../lib/studentDocumentStatus'
import { formatCourseMembership, type CourseMembership } from '../lib/courseMembershipLabel'
import { useListQuery } from '../hooks/useListQuery'
import { usePagedSlice } from '../hooks/usePagedSlice'
import { useTableSort } from '../hooks/useTableSort'
import { sortPeople, type PersonSortContext } from '../lib/sortPeople'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { SortableTh } from '../components/SortableTh'
import { EmailLink, WhatsAppLink } from '../components/ContactLinks'
import { PersonForm } from '../components/PersonForm'
import { PrimaryButton } from '../components/Buttons'
import { KpiCards } from '../components/KpiCards'
import { ListToolbar } from '../components/ListToolbar'
import { ListPagination } from '../components/ListPagination'
import {
  tableWideClass,
  tableWrapClass,
  tdClass,
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
  const [identityIds, setIdentityIds] = useState<Set<string>>(() => new Set())
  const [coursesByStudent, setCoursesByStudent] = useState<Map<string, CourseMembership[]>>(
    () => new Map(),
  )
  const [creating, setCreating] = useState(false)
  const { search, status: rawStatus, setSearch, setStatus } = useListQuery()
  const { sortKey, sortDir, toggleSort } = useTableSort()
  const l = metaFor(type)
  const isStudent = type === 'student'
  const status =
    isPersonListStatus(rawStatus) && (isStudent || !rawStatus.startsWith('documenti_'))
      ? rawStatus
      : ''

  async function reload() {
    const rows = await listPeople(type)
    if (type !== 'student') {
      setPeople(rows)
      setIdentityIds(new Set())
      setCoursesByStudent(new Map())
      return
    }
    const [ids, courses] = await Promise.all([
      listStudentIdsWithIdentityFile(),
      listStudentCourseMap(),
    ])
    setPeople(rows)
    setIdentityIds(ids)
    setCoursesByStudent(courses)
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

  const courseLabelOf = useMemo(
    () => (id: string) => formatCourseMembership(coursesByStudent.get(id), ''),
    [coursesByStudent],
  )

  const searched = useMemo(
    () =>
      people.filter((p) =>
        matchesSearch(
          `${p.first_name} ${p.last_name} ${p.tax_code} ${p.email} ${p.fad_email} ${courseLabelOf(p.id)}`,
          search,
        ),
      ),
    [people, search, courseLabelOf],
  )

  const listContext = useMemo<PersonSortContext>(
    () => ({
      hasIdentityFile: (id) => identityIds.has(id),
      courseLabel: courseLabelOf,
    }),
    [identityIds, courseLabelOf],
  )

  const filtered = useMemo(
    () => searched.filter((p) => matchesPersonStatus(p, status, listContext)),
    [searched, status, listContext],
  )

  const activeSortKey =
    !isStudent && (sortKey === 'documenti' || sortKey === 'corso') ? 'name' : sortKey

  const sorted = useMemo(
    () => sortPeople(filtered, activeSortKey, sortDir, listContext),
    [filtered, activeSortKey, sortDir, listContext],
  )

  const {
    fad_ok: fadOk,
    fad_da_compilare: fadMissing,
    senza_email: noEmail,
    con_inps: withInps,
    documenti_mancanti: docsMissing,
  } = useMemo(() => countPersonStatuses(people, listContext), [people, listContext])
  const { page, setPage, pages, slice, pageSize } = usePagedSlice(
    sorted,
    `${type}|${search}|${status}|${activeSortKey}|${sortDir}|${identityIds.size}|${coursesByStudent.size}`,
  )

  const statusLabel =
    status === 'fad_ok'
      ? 'FAD OK'
      : status === 'fad_da_compilare'
        ? 'FAD da compilare'
        : status === 'senza_email'
          ? 'Senza email'
          : status === 'con_inps'
            ? 'Con prestazione INPS'
            : status === 'documenti_ok'
              ? 'Documenti ok'
              : status === 'documenti_mancanti'
                ? 'Documenti mancanti'
                : ''

  function toggleStatus(key: string) {
    setStatus(status === key ? '' : key)
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: l.title,
      rows: sorted,
      format,
      filters: describeFilters([statusLabel, search && `ricerca «${search}»`]),
      columns: [
        { header: 'Nominativo', value: (p) => fullName(p) },
        ...(isStudent
          ? [
              {
                header: 'Corso',
                value: (p: Person) => formatCourseMembership(coursesByStudent.get(p.id)),
              },
            ]
          : []),
        { header: 'Codice fiscale', value: (p) => p.tax_code || '' },
        { header: 'Nato/a il', value: (p) => fmtDate(p.birth_date) },
        { header: 'Email', value: (p) => p.email || '' },
        { header: 'FAD', value: (p) => (hasCompleteFadCredentials(p) ? 'OK' : 'Da compilare') },
        { header: 'Telefono', value: (p) => p.phone || '' },
        { header: 'Città', value: (p) => p.city || '' },
        ...(isStudent
          ? [
              { header: 'INPS', value: (p: Person) => inpsBenefitLabel(p.inps_benefit) || '—' },
              {
                header: 'Documenti',
                value: (p: Person) =>
                  studentDocumentExportValue(
                    checkStudentDocuments(p, listContext.hasIdentityFile?.(p.id) ?? false),
                  ),
              },
            ]
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
            hint: 'Utente o email',
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
          ...(isStudent
            ? [
                {
                  key: 'documenti_mancanti',
                  label: 'Documenti mancanti',
                  hint: 'File assente, dati incompleti o scadenza',
                  value: docsMissing,
                  tone: docsMissing > 0 ? ('warn' as const) : ('ok' as const),
                  active: status === 'documenti_mancanti',
                  onClick: () => toggleStatus('documenti_mancanti'),
                },
              ]
            : []),
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
        placeholder={
          isStudent
            ? 'Cerca per nome, codice fiscale, email o corso…'
            : 'Cerca per nome, codice fiscale o email…'
        }
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
              <SortableTh
                label="Nominativo"
                column="name"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              {isStudent && (
                <SortableTh
                  label="Corso"
                  column="corso"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggleSort}
                />
              )}
              <SortableTh
                label="Codice fiscale"
                column="tax_code"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Nato/a il"
                column="birth_date"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Email"
                column="email"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="FAD"
                column="fad"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Telefono"
                column="phone"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Città"
                column="city"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              {isStudent && (
                <SortableTh
                  label="INPS"
                  column="inps"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggleSort}
                />
              )}
              {isStudent && (
                <SortableTh
                  label="Documenti"
                  column="documenti"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggleSort}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {slice.map((p) => (
              <tr key={p.id} className={trClass}>
                <td className={tdClass}>
                  <Link
                    to={`${l.basePath}/${p.id}`}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {fullName(p)}
                  </Link>
                </td>
                {isStudent && (
                  <td className={tdClass}>{formatCourseMembership(coursesByStudent.get(p.id))}</td>
                )}
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
                {isStudent && (
                  <td className={tdClass}>
                    <DocumentStatusBadge
                      check={checkStudentDocuments(p, identityIds.has(p.id))}
                    />
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isStudent ? 10 : 7}
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
      <ListPagination
        page={page}
        pages={pages}
        pageSize={pageSize}
        total={sorted.length}
        onPage={setPage}
      />
    </div>
  )
}
