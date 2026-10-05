import { useEffect, useMemo, useState } from 'react'
import type { Person, PersonType } from '../types/db'
import { metaFor } from '../data/personTypes'
import { fullName } from '../lib/format'
import { personBrowseSortKeys } from '../lib/sortPeople'
import { usePeopleBrowse } from '../hooks/usePeopleBrowse'
import { PersonBrowseBar } from './PersonBrowseBar'
import { hasCompleteFadCredentials } from '../lib/fadCredentials'
import { FAD_LOGIN_URL } from '../lib/fadLogin'
import { fadShareForPerson, type FadShare } from '../lib/fadShareMessage'
import { toggleId } from '../lib/toggleIdSet'
import { openExternalHref } from '../lib/openExternalHref'
import { sendFadCredentialsEmails } from '../services/sendFadCredentialsEmail'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { SegmentedControl } from './SegmentedControl'

const roles: { type: PersonType; label: string }[] = [
  { type: 'student', label: 'Alunni' },
  { type: 'teacher', label: 'Docenti' },
  { type: 'tutor', label: 'Tutor' },
  { type: 'admin_staff', label: 'Amministrativi' },
]

const emptyPeople: Person[] = []

type Channel = 'email' | 'whatsapp'

type Props = {
  peopleByType: Partial<Record<PersonType, Person[]>>
  courseLabel: string
}

export function FadShareBulk({ peopleByType, courseLabel }: Props) {
  const [role, setRole] = useState<PersonType>('student')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [opened, setOpened] = useState<Record<Channel, Set<string>>>({
    email: new Set(),
    whatsapp: new Set(),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const people = peopleByType[role] ?? emptyPeople
  const meta = metaFor(role)
  const peopleBrowse = usePeopleBrowse(people)
  const peopleSortKeys = useMemo(() => personBrowseSortKeys(role === 'student'), [role])
  const peopleKey = people
    .map((person) =>
      [
        person.id,
        hasCompleteFadCredentials(person) ? '1' : '0',
        person.email.trim() ? 'e' : '',
        person.phone.trim() ? 'p' : '',
      ].join(':'),
    )
    .join('|')

  const rows = useMemo(
    () =>
      peopleBrowse.filtered.map((person) => ({
        person,
        share: fadShareForPerson(person, courseLabel),
      })),
    [peopleBrowse.filtered, courseLabel],
  )

  useEffect(() => {
    peopleBrowse.setSearch('')
    const ready = people
      .filter((person) => canReceive(fadShareForPerson(person, courseLabel)))
      .map((person) => person.id)
    setSelected(new Set(ready))
    setOpened({ email: new Set(), whatsapp: new Set() })
    setError('')
    setInfo('')
    // peopleKey cambia solo quando cambiano le persone del ruolo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, peopleKey, courseLabel])

  const selectedRows = rows.filter((row) => selected.has(row.person.id))
  const emailCount = selectedRows.filter((row) => row.share?.mailto).length
  const whatsappCount = selectedRows.filter((row) => row.share?.whatsapp).length

  function markOpened(channel: Channel, id: string) {
    setOpened((prev) => ({
      ...prev,
      [channel]: new Set(prev[channel]).add(id),
    }))
  }

  function openNext(channel: Channel) {
    const next = rows.find((row) => {
      if (!selected.has(row.person.id) || opened[channel].has(row.person.id)) return false
      return channel === 'email' ? Boolean(row.share?.mailto) : Boolean(row.share?.whatsapp)
    })
    const href = channel === 'email' ? next?.share?.mailto : next?.share?.whatsapp
    if (!next || !href) {
      setError('')
      setInfo('Hai già aperto tutti i selezionati per questo canale.')
      return
    }
    openExternalHref(href, channel === 'whatsapp')
    markOpened(channel, next.person.id)
    setError('')
    setInfo(`Aperto per ${fullName(next.person)}.`)
  }

  async function sendEmails() {
    const personIds = selectedRows
      .filter((row) => row.share?.mailto)
      .map((row) => row.person.id)
    if (personIds.length === 0) {
      setError('Nessuna email tra le persone selezionate.')
      setInfo('')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const result = await sendFadCredentialsEmails({
        audience: meta.table,
        personIds,
        courseName: courseLabel,
      })
      const skipped = result.skipped.map((item) => `${item.name}: ${item.reason}`).join(' · ')
      setInfo(
        skipped
          ? `Inviate ${result.sent} email. Non inviate: ${skipped}`
          : `Inviate ${result.sent} email.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invio email non riuscito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Invia credenziali FAD</h3>
          <p className="mt-1 text-xs text-slate-500">
            Il messaggio include link, username e password.
            <a
              href={FAD_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-indigo-600 hover:underline"
            >
              {FAD_LOGIN_URL}
            </a>
          </p>
        </div>
      </div>

      <div className="mb-3">
        <SegmentedControl
          ariaLabel="Ruolo per l'invio credenziali"
          value={role}
          onChange={setRole}
          options={roles.map((item) => ({ value: item.type, label: item.label }))}
        />
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun {meta.singular} associato a questo corso.</p>
      ) : (
        <>
          <div className="mb-2">
            <PersonBrowseBar
              search={peopleBrowse.search}
              onSearch={peopleBrowse.setSearch}
              sortKey={peopleBrowse.sortKey}
              sortDir={peopleBrowse.sortDir}
              onSortKey={peopleBrowse.setSortKey}
              onSortDir={peopleBrowse.setSortDir}
              sortKeys={peopleSortKeys}
            />
          </div>
        <ul className="max-h-80 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
          {rows.map((row) => {
            const share = row.share
            const enabled = canReceive(share)
            return (
              <li key={row.person.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={!enabled}
                    checked={enabled && selected.has(row.person.id)}
                    onChange={() => setSelected((current) => toggleId(current, row.person.id))}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{fullName(row.person)}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {rowHint(row.person, share)}
                    </span>
                  </span>
                </label>
                {share?.mailto && (
                  <a
                    href={share.mailto}
                    className="text-xs text-indigo-600 hover:underline"
                    onClick={() => markOpened('email', row.person.id)}
                  >
                    Email
                  </a>
                )}
                {share?.whatsapp && (
                  <a
                    href={share.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline"
                    onClick={() => markOpened('whatsapp', row.person.id)}
                  >
                    WhatsApp
                  </a>
                )}
              </li>
            )
          })}
        </ul>
        {rows.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">Nessun risultato per la ricerca.</p>
        )}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <SecondaryButton type="button" disabled={whatsappCount === 0} onClick={() => openNext('whatsapp')}>
          Apri prossimo WhatsApp ({whatsappCount})
        </SecondaryButton>
        <SecondaryButton type="button" disabled={emailCount === 0} onClick={() => openNext('email')}>
          Apri prossima email ({emailCount})
        </SecondaryButton>
        <PrimaryButton type="button" disabled={busy || emailCount === 0} onClick={() => void sendEmails()}>
          {busy ? 'Invio…' : `Invia email ai selezionati (${emailCount})`}
        </PrimaryButton>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        WhatsApp e l’email del programma di posta si aprono una persona alla volta, già compilate.
        «Invia email ai selezionati» spedisce i messaggi dalla scuola.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-2 text-sm text-slate-600">{info}</p>}
    </div>
  )
}

function canReceive(share: FadShare | null): boolean {
  return Boolean(share && (share.mailto || share.whatsapp))
}

function rowHint(
  person: Pick<Person, 'fad_email' | 'email' | 'fad_password'>,
  share: FadShare | null,
): string {
  if (!hasCompleteFadCredentials(person)) return 'Credenziali da compilare nella scheda'
  if (!share?.mailto && !share?.whatsapp) return 'Manca email e telefono'
  if (!share.mailto) return 'Pronto su WhatsApp · email mancante'
  if (!share.whatsapp) return 'Pronto via email · telefono mancante'
  return 'Pronto via email e WhatsApp'
}
