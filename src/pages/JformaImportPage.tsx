import { useState, type ReactNode } from 'react'
import {
  importCoursesFromCsv,
  importEventsFromIcs,
  type CourseImportSummary,
  type EventImportSummary,
} from '../services/jformaImport'
import { PrimaryButton } from '../components/Buttons'

async function readFile(file: File): Promise<string> {
  return await file.text()
}

export function JformaImportPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [icsFile, setIcsFile] = useState<File | null>(null)
  const [courseResult, setCourseResult] = useState<CourseImportSummary | null>(null)
  const [eventResult, setEventResult] = useState<EventImportSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!csvFile && !icsFile) {
      setError('Seleziona almeno un file CSV corsi o ICS calendario.')
      return
    }

    setBusy(true)
    setError('')
    setCourseResult(null)
    setEventResult(null)

    try {
      if (csvFile) {
        setCourseResult(await importCoursesFromCsv(await readFile(csvFile)))
      }
      if (icsFile) {
        setEventResult(await importEventsFromIcs(await readFile(icsFile)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import non riuscito.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import da JForma</h1>
        <p className="mt-2 text-sm text-slate-600">
          Carica un export CSV dei corsi e/o un file ICS del calendario lezioni. I corsi nuovi
          restano in stato bozza; i corsi esistenti si aggiornano per codice o per nome ed edizione.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">CSV corsi</label>
          <p className="mt-1 text-xs text-slate-500">
            Colonne: nome (o titolo), edizione, codice, cup, data_inizio, data_fine, ore, note.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">ICS calendario</label>
          <p className="mt-1 text-xs text-slate-500">
            Export calendario da JForma. Gli eventi senza corso riconoscibile restano senza
            collegamento.
          </p>
          <input
            type="file"
            accept=".ics,text/calendar"
            className="mt-2 block w-full text-sm"
            onChange={(e) => setIcsFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <PrimaryButton type="button" disabled={busy} onClick={() => void handleImport()}>
          {busy ? 'Import in corso…' : 'Avvia import'}
        </PrimaryButton>
      </section>

      {courseResult && (
        <ResultCard title="Risultato corsi">
          <p>
            Creati: {courseResult.created} · Aggiornati: {courseResult.updated} · Saltati:{' '}
            {courseResult.skipped}
          </p>
          {courseResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
              {courseResult.errors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}
        </ResultCard>
      )}

      {eventResult && (
        <ResultCard title="Risultato calendario">
          <p>
            Creati: {eventResult.created} · Aggiornati: {eventResult.updated} · Senza corso:{' '}
            {eventResult.unassigned}
          </p>
          {eventResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
              {eventResult.errors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}
        </ResultCard>
      )}
    </div>
  )
}

function ResultCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
      <h2 className="font-medium text-slate-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}
