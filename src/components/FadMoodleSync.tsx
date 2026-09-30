import { useState } from 'react'
import { SecondaryButton } from './Buttons'
import { syncFadCourse, type FadSyncResult } from '../services/syncFadCourse'

export function FadMoodleSync({ courseId }: { courseId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FadSyncResult | null>(null)

  async function run() {
    setBusy(true)
    setError('')
    try {
      setResult(await syncFadCourse(courseId))
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Sincronizzazione FAD non riuscita')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">FAD Moodle</h2>
          <p className="text-sm text-slate-500">
            Crea o aggiorna il corso, crea gli utenti mancanti con le credenziali FAD e pubblica il calendario.
          </p>
        </div>
        <SecondaryButton type="button" onClick={() => void run()} disabled={busy}>
          {busy ? 'Sincronizzo…' : 'Sincronizza FAD'}
        </SecondaryButton>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            Corso Moodle {result.moodleCourseId}
            {result.bbbInstanceId ? ` · stanza ${result.bbbInstanceId}` : ''} · utenti creati{' '}
            {result.createdUsers} · iscritti {result.enrolled} · lezioni {result.events} · presenze{' '}
            {result.attendance}
          </p>
          {result.warning && <p className="text-amber-700">{result.warning}</p>}
          {result.skipped.length > 0 && (
            <ul className="list-disc pl-5 text-slate-500">
              {result.skipped.map((row) => (
                <li key={`${row.name}-${row.reason}`}>
                  {row.name}: {row.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
