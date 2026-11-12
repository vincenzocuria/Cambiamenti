import { useMemo, useState } from 'react'
import { school } from '../data/school'
import type { Person } from '../types/db'
import type { EnrollmentInfo } from '../services/enrollments'
import { getCourse } from '../services/courses'
import { uploadDocument } from '../services/documents'
import {
  courseVariations,
  regionAddressFor,
  variationLetterHtml,
  variationSentence,
  type RegionAddress,
  type StudentVariation,
} from '../lib/studentVariationLetter'
import { PrimaryButton, SecondaryButton } from './Buttons'

function key(v: StudentVariation) {
  return `${v.person.id}:${v.kind}`
}

/** Comunicazione «variazione allievi» alla Regione, compilata dal gestionale. */
export function VariationLetterPanel({
  courseId,
  people,
  enrollments,
}: {
  courseId: string
  people: Person[]
  enrollments: Map<string, EnrollmentInfo>
}) {
  const variations = useMemo(() => courseVariations(people, enrollments), [people, enrollments])
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [protocol, setProtocol] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [address, setAddress] = useState<RegionAddress | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (variations.length === 0) return null

  async function start() {
    setError('')
    setInfo('')
    if (!open) {
      try {
        const course = await getCourse(courseId)
        setAddress(regionAddressFor(course))
        // Di base: le variazioni dell'ultimo giorno in cui ce ne sono state
        const last = variations[0].day
        setPicked(new Set(variations.filter((v) => v.day === last).map(key)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Corso non trovato')
        return
      }
    }
    setOpen((v) => !v)
  }

  async function generate(save: boolean) {
    if (!address) return
    const chosen = variations.filter((v) => picked.has(key(v)))
    if (!chosen.length) {
      setError('Scegli almeno una variazione')
      return
    }
    // La finestra va aperta subito al clic, altrimenti il browser la blocca
    const w = window.open('', '_blank')
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const course = await getCourse(courseId)
      // Elenco aggiornato: chi è iscritto alla data della comunicazione
      const students = people.filter((p) => {
        const e = enrollments.get(p.id)
        if (!e) return true
        if (e.enrolled_on && e.enrolled_on > date) return false
        if (e.left_on && e.left_on <= date) return false
        return true
      })
      const html = variationLetterHtml({
        course,
        variations: chosen,
        students,
        protocol,
        date,
        address,
        logoUrl: `${window.location.origin}${school.logoSrc}`,
      })
      if (w) {
        w.document.write(html)
        w.document.close()
      }
      if (save) {
        const title = `Comunicazione variazione allievi${protocol ? ` prot. ${protocol}` : ''} del ${date
          .split('-')
          .reverse()
          .join('/')}`
        await uploadDocument({
          courseId,
          category: 'module',
          title,
          file: new File([html], `${title.replace(/[^\w.-]+/g, '-')}.html`, { type: 'text/html' }),
        })
        setInfo('Salvata nei documenti del corso.')
      }
      if (!w) setError('Il browser ha bloccato la nuova finestra: consenti i popup per questo sito')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-slate-700">
          {variations.length} variazion{variations.length === 1 ? 'e' : 'i'} di allievi da comunicare alla Regione
        </span>
        <SecondaryButton size="sm" type="button" onClick={() => void start()}>
          {open ? 'Chiudi' : 'Comunicazione alla Regione'}
        </SecondaryButton>
      </div>

      {open && address && (
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            {variations.map((v) => (
              <label key={key(v)} className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={picked.has(key(v))}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(key(v))
                      else next.delete(key(v))
                      return next
                    })
                  }
                />
                <span>{variationSentence(v).replace(/;$/, '')}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-0.5 text-xs text-slate-600">
              Protocollo n.
              <input
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="h-8 w-24 rounded-lg border border-slate-300 px-2"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs text-slate-600">
              Data
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 px-2"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs text-slate-600">
              Invio via PEC a
              <input
                value={address.pecTo}
                onChange={(e) => setAddress({ ...address, pecTo: e.target.value })}
                className="h-8 rounded-lg border border-slate-300 px-2"
              />
            </label>
          </div>
          <label className="flex flex-col gap-0.5 text-xs text-slate-600">
            Destinatario
            <textarea
              value={address.recipient}
              onChange={(e) => setAddress({ ...address, recipient: e.target.value })}
              rows={4}
              className="rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-slate-600">
            Oggetto (prima del titolo del percorso)
            <textarea
              value={address.subjectPrefix}
              onChange={(e) => setAddress({ ...address, subjectPrefix: e.target.value })}
              rows={3}
              className="rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" onClick={() => void generate(true)} disabled={busy}>
              {busy ? 'Preparo…' : 'Genera e salva nei documenti'}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => void generate(false)} disabled={busy}>
              Solo anteprima
            </SecondaryButton>
          </div>
          <p className="text-xs text-slate-500">
            Si apre la lettera con il Mod. 1/B aggiornato: stampala o salvala in PDF, firmala e inviala via PEC.
          </p>
          {info && <p className="text-xs text-emerald-700">{info}</p>}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
