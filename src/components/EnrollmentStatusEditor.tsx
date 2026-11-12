import { useState } from 'react'
import type { Course } from '../types/db'
import {
  reactivateStudent,
  transferStudent,
  withdrawStudent,
  type EnrollmentInfo,
} from '../services/enrollments'
import { recomputeFadAttendance } from '../services/fadAttendance'
import { syncMoodleEnrolment } from '../services/syncFadCourse'
import { PrimaryButton, SecondaryButton } from './Buttons'

function itDay(day: string | null): string {
  if (!day) return ''
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

/** Le presenze FAD già lette tengono conto del nuovo stato (errori ignorati: corso senza presenze). */
async function refreshFad(courseIds: string[]) {
  await Promise.all(courseIds.map((id) => recomputeFadAttendance(id).catch(() => undefined)))
}

/** Moodle segue il gestionale: messaggi dei corsi collegati (quelli non collegati vengono saltati). */
async function syncMoodle(courseIds: string[], studentId: string): Promise<string> {
  const out: string[] = []
  for (const id of courseIds) {
    try {
      const r = await syncMoodleEnrolment(id, studentId)
      if (r.done || !/non collegato/i.test(r.message)) out.push(r.message)
    } catch (e) {
      out.push(`Moodle: ${e instanceof Error ? e.message : 'aggiornamento non riuscito'}`)
    }
  }
  return out.filter(Boolean).join(' · ')
}

function courseLabel(c: { name: string; edition: string | null } | null): string {
  if (!c) return 'altro corso'
  return c.edition ? `${c.name} – ${c.edition}` : c.name
}

/** Riga di stato dell'iscrizione: mostra ritiro/trasferimento e permette di cambiarlo. */
export function EnrollmentStatusEditor({
  courseId,
  studentId,
  info,
  courses,
  onChanged,
}: {
  courseId: string
  studentId: string
  info: EnrollmentInfo | undefined
  courses: Course[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<'ritiro' | 'trasferimento'>('ritiro')
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [moodleInfo, setMoodleInfo] = useState('')

  const status = info?.status ?? 'attivo'

  async function save() {
    setError('')
    if (!day) {
      setError('Indica la data')
      return
    }
    if (action === 'trasferimento' && !target) {
      setError('Scegli il corso di destinazione')
      return
    }
    setBusy(true)
    try {
      if (action === 'ritiro') await withdrawStudent(courseId, studentId, day, note.trim())
      else await transferStudent(courseId, target, studentId, day, note.trim())
      const ids = action === 'ritiro' ? [courseId] : [courseId, target]
      setMoodleInfo(await syncMoodle(ids, studentId))
      await refreshFad(ids)
      setOpen(false)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  async function reactivate() {
    setBusy(true)
    setError('')
    try {
      await reactivateStudent(courseId, studentId)
      setMoodleInfo(await syncMoodle([courseId], studentId))
      await refreshFad([courseId])
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'ritirato' && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
            Ritirato dal {itDay(info?.left_on ?? null)}
          </span>
        )}
        {status === 'trasferito' && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
            Trasferito a {courseLabel(info?.to_course ?? null)} dal {itDay(info?.left_on ?? null)}
          </span>
        )}
        {status === 'attivo' && info?.enrolled_on && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
            {info.from_course ? `Da ${courseLabel(info.from_course)}, ` : 'Iscritto '}dal {itDay(info.enrolled_on)}
          </span>
        )}
        {info?.status_note && <span className="text-slate-500">{info.status_note}</span>}
        {status === 'attivo' ? (
          <button type="button" className="text-slate-500 underline hover:text-slate-700" onClick={() => setOpen((v) => !v)}>
            {open ? 'Chiudi' : 'Ritira / trasferisci'}
          </button>
        ) : (
          <button
            type="button"
            className="text-slate-500 underline hover:text-slate-700"
            onClick={() => void reactivate()}
            disabled={busy}
          >
            Annulla {status === 'ritirato' ? 'ritiro' : 'trasferimento'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-0.5 text-slate-600">
            Operazione
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'ritiro' | 'trasferimento')}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2"
            >
              <option value="ritiro">Ritiro dal corso</option>
              <option value="trasferimento">Trasferimento ad altro corso</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-slate-600">
            {action === 'ritiro' ? 'Non frequenta più dal' : 'Nel nuovo corso dal'}
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 px-2"
            />
          </label>
          {action === 'trasferimento' && (
            <label className="flex min-w-0 flex-col gap-0.5 text-slate-600 sm:min-w-64">
              Corso di destinazione
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2"
              >
                <option value="">— scegli —</option>
                {courses
                  .filter((c) => c.id !== courseId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `${c.code} · ` : ''}
                      {courseLabel(c)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-slate-600">
            Motivo / nota
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="facoltativo"
              className="h-8 rounded-lg border border-slate-300 px-2"
            />
          </label>
          <PrimaryButton type="button" className="!h-8 !px-3 !text-xs" onClick={() => void save()} disabled={busy}>
            {busy ? 'Salvo…' : 'Conferma'}
          </PrimaryButton>
          <SecondaryButton size="sm" type="button" onClick={() => setOpen(false)}>
            Annulla
          </SecondaryButton>
        </div>
      )}
      {moodleInfo && <p className="mt-1 text-slate-500">{moodleInfo}</p>}
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  )
}
