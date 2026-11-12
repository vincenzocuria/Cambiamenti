import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Course, FadAttendanceStatus } from '../types/db'
import {
  linkMoodleCourse,
  listFadLogEvents,
  listFadSessions,
  listMoodleCourses,
  recomputeFadAttendance,
  syncFadAttendance,
  updateFadAttendance,
  updateFadSession,
  type FadAttendanceRow,
  type FadSessionWithRows,
  type MoodleCourseOption,
} from '../services/fadAttendance'
import {
  attendanceCsv,
  closedSourceLabels,
  declarationHtml,
  eventsForSessions,
  exportableSessions,
  exitSourceLabels,
  fadTotals,
  itDate,
  logCsv,
  periodText,
  romeIso,
  romeTime,
  sortedRows,
  statusLabels,
  statusTone,
  studentName,
} from '../lib/fadAttendance'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { KpiCards } from './KpiCards'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fileBase(course: Course): string {
  return `Presenze FAD ${course.name} ${course.edition}`.replace(/[\\/:*?"<>|]+/g, ' ').trim()
}

export function FadAttendancePanel({ course, onCourseChanged }: { course: Course; onCourseChanged: () => void }) {
  const [sessions, setSessions] = useState<FadSessionWithRows[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [period, setPeriod] = useState({ from: '', to: '' })

  const load = useCallback(async () => {
    try {
      setSessions(await listFadSessions(course.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento presenze non riuscito')
    }
  }, [course.id])

  useEffect(() => {
    void load()
  }, [load])

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label)
    setError('')
    setInfo('')
    try {
      const msg = await fn()
      if (msg) setInfo(msg)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setBusy('')
    }
  }

  const totals = useMemo(() => fadTotals(sessions ?? []), [sessions])
  const selected = useMemo(() => exportableSessions(sessions ?? [], period), [sessions, period])
  const partial = !!(period.from || period.to)
  const excludedCount = (sessions ?? []).filter((s) => s.excluded).length
  const suffix = partial && selected.length ? ` ${periodText(selected).replace(/\//g, '-')}` : ''

  const sync = () =>
    run('sync', async () => {
      const r = await syncFadAttendance(course.id)
      return `Letti ${r.readEvents ?? 0} eventi (${r.newEvents} nuovi) · ${r.days} giornate · ${r.keptManual} correzioni manuali mantenute${
        r.unmatched.length ? ` · non abbinati agli alunni: ${r.unmatched.join(', ')}` : ''
      }`
    })

  const exportCsv = () => download(`${fileBase(course)}${suffix}.csv`, attendanceCsv(selected), 'text/csv;charset=utf-8')

  const exportLog = () =>
    run('log', async () => {
      const events = eventsForSessions(await listFadLogEvents(course.id), selected)
      download(`Log Moodle ${fileBase(course)}${suffix}.csv`, logCsv(events), 'text/csv;charset=utf-8')
    })

  const openDeclaration = () => {
    const w = window.open('', '_blank')
    if (!w) {
      setError('Il browser ha bloccato la nuova finestra: consenti i popup per questo sito')
      return
    }
    w.document.write(declarationHtml(course, selected, { partial }))
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <MoodleLink course={course} onChanged={onCourseChanged} />

      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton type="button" onClick={sync} disabled={!!busy || !course.moodle_course_id}>
          {busy === 'sync' ? 'Leggo da Moodle…' : 'Leggi presenze da Moodle'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={openDeclaration} disabled={!selected.length}>
          Dichiarazione per la Regione
        </SecondaryButton>
        <SecondaryButton type="button" onClick={exportCsv} disabled={!selected.length}>
          Esporta presenze (Excel)
        </SecondaryButton>
        <SecondaryButton type="button" onClick={exportLog} disabled={!!busy || !selected.length}>
          {busy === 'log' ? 'Preparo…' : 'Log Moodle originale'}
        </SecondaryButton>
      </div>
      {sessions && sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="text-slate-600">Esporta le giornate</span>
          <label className="flex items-center gap-1 text-slate-500">
            dal
            <input
              type="date"
              value={period.from}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 px-2"
            />
          </label>
          <label className="flex items-center gap-1 text-slate-500">
            al
            <input
              type="date"
              value={period.to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 px-2"
            />
          </label>
          {partial && (
            <SecondaryButton size="sm" type="button" onClick={() => setPeriod({ from: '', to: '' })}>
              Tutto il corso
            </SecondaryButton>
          )}
          <span className="text-xs text-slate-500">
            {selected.length} giornate {selected.length ? periodText(selected) : ''}
            {excludedCount ? ` · ${excludedCount} escluse (non FAD)` : ''}
          </span>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Le presenze si aggiornano da sole ogni notte per i corsi collegati a Moodle. Le correzioni fatte a mano restano.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}

      {sessions && sessions.length > 0 && (
        <KpiCards
          compact
          className="mb-0"
          items={[
            { key: 'g', label: 'Giornate', value: totals.days },
            { key: 'f', label: 'Fino alla chiusura', value: totals.fino, tone: 'ok' },
            { key: 'p', label: 'Usciti prima', value: totals.prima, tone: totals.prima ? 'warn' : 'default' },
            { key: 'v', label: 'Da verificare', value: totals.verificare, tone: totals.verificare ? 'warn' : 'default' },
            { key: 'a', label: 'Assenze', value: totals.assenti },
          ]}
        />
      )}

      {sessions == null ? (
        <p className="text-sm text-slate-400">Caricamento…</p>
      ) : sessions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          Nessuna presenza ancora letta. Collega il corso a Moodle e premi «Leggi presenze da Moodle».
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Giornata</th>
                <th className="px-3 py-2 font-medium">Chiusura aula</th>
                <th className="px-3 py-2 font-medium">Come</th>
                <th className="px-3 py-2 text-right font-medium">Fino alla chiusura</th>
                <th className="px-3 py-2 text-right font-medium">Usciti prima</th>
                <th className="px-3 py-2 text-right font-medium">Da verificare</th>
                <th className="px-3 py-2 text-right font-medium">Assenti</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const c = (st: FadAttendanceStatus) => s.rows.filter((r) => r.status === st).length
                const isOpen = openDay === s.id
                return (
                  <SessionRows
                    key={s.id}
                    session={s}
                    open={isOpen}
                    counts={[c('fino_chiusura'), c('uscito_prima'), c('da_verificare'), c('assente')]}
                    onToggle={() => setOpenDay(isOpen ? null : s.id)}
                    onChanged={async (recompute) => {
                      if (recompute) await run('recompute', async () => void (await recomputeFadAttendance(course.id)))
                      else await load()
                    }}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MoodleLink({ course, onChanged }: { course: Course; onChanged: () => void }) {
  const [options, setOptions] = useState<MoodleCourseOption[] | null>(null)
  const [value, setValue] = useState(course.moodle_course_id ? String(course.moodle_course_id) : '')
  const [editing, setEditing] = useState(!course.moodle_course_id)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadOptions() {
    setError('')
    try {
      setOptions(await listMoodleCourses())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Elenco corsi Moodle non disponibile')
    }
  }

  async function save() {
    const id = Number(value)
    setSaving(true)
    setError('')
    try {
      await linkMoodleCourse(course.id, Number.isFinite(id) && id > 0 ? id : null)
      setEditing(false)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <span>
          Collegato al corso Moodle n. <b>{course.moodle_course_id}</b>
        </span>
        <SecondaryButton size="sm" type="button" onClick={() => setEditing(true)}>
          Cambia
        </SecondaryButton>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-3 text-sm shadow-sm">
      <p className="mb-2 font-medium text-slate-700">Corso Moodle da cui leggere le presenze</p>
      <div className="flex flex-wrap items-center gap-2">
        {options ? (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 max-w-full rounded-lg border border-slate-300 bg-white px-2"
          >
            <option value="">— scegli —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {o.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
              placeholder="ID corso Moodle"
              inputMode="numeric"
              className="h-9 w-36 rounded-lg border border-slate-300 px-2"
            />
            <SecondaryButton size="sm" type="button" onClick={() => void loadOptions()}>
              Scegli dall'elenco Moodle
            </SecondaryButton>
          </>
        )}
        <PrimaryButton type="button" className="!h-9" onClick={() => void save()} disabled={saving}>
          Salva
        </PrimaryButton>
        {course.moodle_course_id && (
          <SecondaryButton size="sm" type="button" onClick={() => setEditing(false)}>
            Annulla
          </SecondaryButton>
        )}
      </div>
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  )
}

function SessionRows({
  session,
  open,
  counts,
  onToggle,
  onChanged,
}: {
  session: FadSessionWithRows
  open: boolean
  counts: [number, number, number, number]
  onToggle: () => void
  onChanged: (recompute: boolean) => Promise<void>
}) {
  const [closeTime, setCloseTime] = useState(romeTime(session.closed_at))
  const [error, setError] = useState('')

  async function saveClosure() {
    const iso = closeTime.trim() ? romeIso(session.day, closeTime) : null
    if (closeTime.trim() && !iso) {
      setError('Ora non valida (es. 16:00)')
      return
    }
    setError('')
    await updateFadSession(session.id, { closed_at: iso, closed_source: iso ? 'manuale' : 'non_determinabile', manual: true })
    await onChanged(true)
  }

  async function resetClosure() {
    await updateFadSession(session.id, { manual: false })
    await onChanged(true)
  }

  async function toggleExcluded() {
    await updateFadSession(session.id, { excluded: !session.excluded })
    await onChanged(false)
  }

  return (
    <>
      <tr
        className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${session.excluded ? 'opacity-50' : ''}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 font-medium text-slate-800">
          <span className="mr-1 inline-block w-3 text-slate-400">{open ? '▾' : '▸'}</span>
          {itDate(session.day)}
          {session.excluded && <span className="ml-2 text-xs font-normal text-slate-500">esclusa</span>}
        </td>
        <td className="px-3 py-2 tabular-nums">{romeTime(session.closed_at) || '—'}</td>
        <td className="px-3 py-2 text-xs text-slate-500">
          {closedSourceLabels[session.closed_source]}
          {session.closed_note && <span className="block">{session.closed_note}</span>}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{counts[0]}</td>
        <td className={`px-3 py-2 text-right tabular-nums ${counts[1] ? 'text-red-600' : ''}`}>{counts[1]}</td>
        <td className={`px-3 py-2 text-right tabular-nums ${counts[2] ? 'text-amber-700' : ''}`}>{counts[2]}</td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-500">{counts[3]}</td>
      </tr>
      {open && (
        <tr className="border-b border-slate-200 bg-slate-50/70">
          <td colSpan={7} className="px-3 py-3">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600">Ora di chiusura dell'aula</span>
              <input
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                placeholder="HH:MM"
                className="h-8 w-28 rounded-lg border border-slate-300 px-2 tabular-nums"
              />
              <SecondaryButton size="sm" type="button" onClick={() => void saveClosure()}>
                Salva e ricalcola
              </SecondaryButton>
              {session.manual && (
                <SecondaryButton size="sm" type="button" onClick={() => void resetClosure()}>
                  Torna al calcolo automatico
                </SecondaryButton>
              )}
              <SecondaryButton size="sm" type="button" onClick={() => void toggleExcluded()}>
                {session.excluded ? 'Includi nelle esportazioni' : 'Escludi dalle esportazioni (non FAD)'}
              </SecondaryButton>
              {error && <span className="text-red-600">{error}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 pr-3 font-medium">Alunno</th>
                    <th className="py-1 pr-3 font-medium">Primo accesso</th>
                    <th className="py-1 pr-3 font-medium">Uscita</th>
                    <th className="py-1 pr-3 font-medium">Uscita da</th>
                    <th className="py-1 pr-3 text-right font-medium">Minuti</th>
                    <th className="py-1 pr-3 text-right font-medium">Pause</th>
                    <th className="py-1 pr-3 font-medium">Esito</th>
                    <th className="py-1 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows(session.rows).map((r) => (
                    <AttendanceRow key={r.id} day={session.day} row={r} onChanged={onChanged} />
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AttendanceRow({
  day,
  row,
  onChanged,
}: {
  day: string
  row: FadAttendanceRow
  onChanged: (recompute: boolean) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [first, setFirst] = useState(romeTime(row.first_join_at))
  const [exit, setExit] = useState(romeTime(row.exit_at))
  const [status, setStatus] = useState<FadAttendanceStatus>(row.status)
  const [note, setNote] = useState(row.note)
  const [error, setError] = useState('')

  async function save() {
    const firstIso = first.trim() ? romeIso(day, first) : null
    const exitIso = exit.trim() ? romeIso(day, exit) : null
    if ((first.trim() && !firstIso) || (exit.trim() && !exitIso)) {
      setError('Ora non valida (es. 09:05)')
      return
    }
    const minutes =
      firstIso && exitIso
        ? Math.max(0, Math.round((Date.parse(exitIso) - Date.parse(firstIso)) / 60000) - row.pause_minutes)
        : null
    await updateFadAttendance(row.id, {
      first_join_at: firstIso,
      exit_at: exitIso,
      exit_source: exitIso && exitIso !== row.exit_at ? 'manuale' : row.exit_source,
      status,
      minutes,
      note,
      manual: true,
    })
    setEditing(false)
    await onChanged(false)
  }

  async function reset() {
    await updateFadAttendance(row.id, { manual: false })
    await onChanged(true)
  }

  if (editing) {
    return (
      <tr className="border-t border-slate-200 bg-white">
        <td className="py-1.5 pr-3 font-medium">{studentName(row)}</td>
        <td className="py-1.5 pr-3">
          <input value={first} onChange={(e) => setFirst(e.target.value)} className="h-8 w-24 rounded border border-slate-300 px-1.5 tabular-nums" />
        </td>
        <td className="py-1.5 pr-3">
          <input value={exit} onChange={(e) => setExit(e.target.value)} className="h-8 w-24 rounded border border-slate-300 px-1.5 tabular-nums" />
        </td>
        <td colSpan={3} className="py-1.5 pr-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (es. da registro firmato)"
            className="h-8 w-full rounded border border-slate-300 px-1.5"
          />
        </td>
        <td className="py-1.5 pr-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FadAttendanceStatus)}
            className="h-8 rounded border border-slate-300 bg-white px-1"
          >
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </td>
        <td className="whitespace-nowrap py-1.5">
          <SecondaryButton size="sm" type="button" onClick={() => void save()}>
            Salva
          </SecondaryButton>{' '}
          <SecondaryButton size="sm" type="button" onClick={() => setEditing(false)}>
            Annulla
          </SecondaryButton>
          {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-slate-200">
      <td className="py-1.5 pr-3 font-medium text-slate-800">
        {studentName(row)}
        {row.note && <span className="block text-xs font-normal text-slate-500">{row.note}</span>}
      </td>
      <td className="py-1.5 pr-3 tabular-nums">{romeTime(row.first_join_at) || '—'}</td>
      <td className="py-1.5 pr-3 tabular-nums">{romeTime(row.exit_at) || '—'}</td>
      <td className="py-1.5 pr-3 text-xs text-slate-500">{exitSourceLabels[row.exit_source]}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{row.minutes ?? '—'}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{row.pause_minutes || ''}</td>
      <td className="py-1.5 pr-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone[row.status]}`}>
          {statusLabels[row.status]}
        </span>
        {row.manual && <span className="ml-1 text-xs text-indigo-600">corretto a mano</span>}
      </td>
      <td className="whitespace-nowrap py-1.5 text-right">
        <SecondaryButton size="sm" type="button" onClick={() => setEditing(true)}>
          Modifica
        </SecondaryButton>
        {row.manual && (
          <>
            {' '}
            <SecondaryButton size="sm" type="button" onClick={() => void reset()}>
              Ripristina
            </SecondaryButton>
          </>
        )}
      </td>
    </tr>
  )
}
