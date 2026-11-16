import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { PrimaryButton } from '../components/Buttons'
import { fieldInputClass } from '../components/Field'
import { fmtDate, formatCourseEdition } from '../lib/format'
import { scaleLabels, surveyGroups, unansweredQuestions } from '../lib/quality'
import { getPublicSurvey, submitPublicSurvey, type PublicSurvey } from '../services/quality'
import { school } from '../data/school'

/** Domande che si possono saltare: aule o piattaforma valgono solo per un tipo di corso. */
const SKIPPABLE = ['ambiente_aule', 'ambiente_piattaforma']

function Scale({ value, onChange, name }: { value: number | undefined; onChange: (v: number) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={
            'flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center transition ' +
            (value === v
              ? 'border-indigo-500 bg-indigo-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300')
          }
        >
          <span className="text-base font-semibold">{v}</span>
          <span className="text-[10px] leading-tight opacity-80">{scaleLabels[v]}</span>
        </button>
      ))}
    </div>
  )
}

/** Questionario di gradimento anonimo, aperto dal link mandato agli allievi (senza login). */
export function SurveyPage() {
  const { token = '' } = useParams()
  const [survey, setSurvey] = useState<PublicSurvey | null | undefined>(undefined)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [teacherScores, setTeacherScores] = useState<Record<string, number>>({})
  const [liked, setLiked] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    getPublicSurvey(token)
      .then(setSurvey)
      .catch(() => setSurvey(null))
  }, [token])

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setError('')
    const missing = unansweredQuestions(scores, SKIPPABLE)
    if (missing.length) {
      setError(`Mancano ${missing.length === 1 ? '1 risposta' : `${missing.length} risposte`}: scegli un voto da 1 a 5 per ogni domanda.`)
      document.getElementById(`q-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    try {
      await submitPublicSurvey({ token, scores, teacherScores, liked, suggestions })
      setSent(true)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invio non riuscito, riprova')
    } finally {
      setBusy(false)
    }
  }

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">{school.shortName}</p>
            <p className="text-xs text-slate-500">Questionario di gradimento</p>
          </div>
        </div>
        {body}
      </div>
    </div>
  )

  if (survey === undefined) return shell(<p className="text-sm text-slate-500">Carico il questionario…</p>)
  if (survey === null)
    return shell(
      <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        Questionario non trovato. Controlla il link che hai ricevuto.
      </p>,
    )
  if (sent)
    return shell(
      <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-semibold text-emerald-700">Grazie!</p>
        <p className="mt-1 text-sm text-slate-600">Le tue risposte sono state registrate in forma anonima. Ci aiutano a migliorare i prossimi corsi.</p>
      </div>,
    )

  const edition = formatCourseEdition(survey.edition)
  const header = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">{survey.course_name}</h1>
      <p className="text-sm text-slate-500">
        {[survey.code, edition, survey.start_date && `${fmtDate(survey.start_date)} – ${fmtDate(survey.end_date)}`].filter(Boolean).join(' · ')}
      </p>
      <p className="mt-3 text-sm text-slate-700">
        Il questionario è <strong>anonimo</strong>: non chiediamo il tuo nome. Per ogni frase scegli un voto da 1 (per niente) a 5 (moltissimo).
        Bastano 3 minuti.
      </p>
    </div>
  )

  if (!survey.open)
    return shell(
      <>
        {header}
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Il questionario è chiuso.</p>
      </>,
    )

  return shell(
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      {header}
      {surveyGroups.map((g) => (
        <fieldset key={g.id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <legend className="px-1 text-base font-semibold text-slate-900">{g.title}</legend>
          {g.questions.map((q) => (
            <div key={q.id} id={`q-${q.id}`} className="space-y-2">
              <p className="text-sm text-slate-800">
                {q.text}
                {SKIPPABLE.includes(q.id) && <span className="text-slate-400"> (facoltativa)</span>}
              </p>
              <Scale name={q.text} value={scores[q.id]} onChange={(v) => setScores((s) => ({ ...s, [q.id]: v }))} />
            </div>
          ))}
          {g.id === 'docenza' && survey.teachers.length > 0 && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">Il tuo giudizio su ciascun docente (facoltativo)</p>
              {survey.teachers.map((t) => (
                <div key={t.id} className="space-y-2">
                  <p className="text-sm text-slate-800">{t.name}</p>
                  <Scale
                    name={t.name}
                    value={teacherScores[t.id]}
                    onChange={(v) => setTeacherScores((s) => ({ ...s, [t.id]: v }))}
                  />
                </div>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <legend className="px-1 text-base font-semibold text-slate-900">I tuoi commenti (facoltativi)</legend>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-700">Cosa ti è piaciuto di più?</span>
          <textarea className={fieldInputClass} rows={3} maxLength={2000} value={liked} onChange={(e) => setLiked(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-700">Cosa possiamo migliorare?</span>
          <textarea className={fieldInputClass} rows={3} maxLength={2000} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
        </label>
      </fieldset>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <PrimaryButton type="submit" disabled={busy} className="w-full">
        {busy ? 'Invio…' : 'Invia il questionario'}
      </PrimaryButton>
    </form>,
  )
}
