import { useState } from 'react'
import type { CourseStaffAssignment, CourseStaffRole } from '../types/db'
import { formatEuro } from '../lib/euroInWords'
import { updateCourseStaffAssignment } from '../services/enrollments'
import { PrimaryButton, SecondaryButton } from './Buttons'

interface Props {
  courseId: string
  personId: string
  role: CourseStaffRole
  assignment: CourseStaffAssignment | undefined
  onSaved: (next: CourseStaffAssignment) => void
}

const inputClass =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

/** Ruoli proposti per le figure esterne (si può scrivere anche altro). */
export const EXTERNAL_ROLE_SUGGESTIONS = [
  'Preparatore',
  'Ricerca e reclutamento allievi',
  'Orientatore',
  'Selezione allievi',
  'Coordinatore',
  'Progettista',
  'Direttore del corso',
  'Valutatore',
  'Esperto esterno',
  'Consulente',
]

function toNumber(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(n) ? null : n
}

/** Moduli/attività, ore e compenso orario della figura sul corso (usati dalla lettera di incarico e dai pagamenti). */
export function StaffAssignmentEditor({ courseId, personId, role, assignment, onSaved }: Props) {
  const isTeacher = role === 'teacher'
  const isExternal = role === 'external'
  const modulesLabel = isTeacher ? 'Moduli' : 'Attività'
  const [open, setOpen] = useState(false)
  const [roleLabel, setRoleLabel] = useState(assignment?.role_label ?? '')
  const [modules, setModules] = useState(assignment?.modules ?? '')
  const [hours, setHours] = useState(assignment?.hours?.toString() ?? '')
  const [rate, setRate] = useState(assignment?.hourly_rate?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const h = assignment?.hours ?? null
  const r = assignment?.hourly_rate ?? null
  const summary = [
    h != null ? `${String(h).replace('.', ',')} ore` : null,
    r != null ? `€ ${formatEuro(r)}/ora` : null,
    h != null && r != null ? `totale € ${formatEuro(h * r)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const next = {
        modules,
        hours: toNumber(hours),
        hourly_rate: toNumber(rate),
        role_label: isExternal ? roleLabel : (assignment?.role_label ?? ''),
      }
      await updateCourseStaffAssignment(courseId, personId, next)
      onSaved({
        role: assignment?.role ?? role,
        ...next,
        modules: modules.trim(),
        role_label: next.role_label.trim(),
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  const label = assignment?.role_label?.trim() ?? ''

  if (!open) {
    return (
      <p className="mt-1 text-xs text-slate-500">
        {isExternal && (
          <span className={label ? 'font-medium text-slate-700' : 'text-amber-700'}>
            {label || 'Ruolo da indicare'}
            {' · '}
          </span>
        )}
        {summary || assignment?.modules ? (
          <>
            Incarico: {summary || 'ore e compenso da indicare'}
            {assignment?.modules ? ` · ${assignment.modules}` : ''}{' '}
          </>
        ) : (
          <span className="text-amber-700">
            Incarico: {isTeacher ? 'moduli, ' : ''}ore e compenso da indicare{' '}
          </span>
        )}
        <button
          type="button"
          className="font-medium text-indigo-600 hover:underline"
          onClick={() => setOpen(true)}
        >
          Modifica
        </button>
      </p>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      {isExternal && (
        <label className="block text-xs font-medium text-slate-600">
          Ruolo
          <input
            className={inputClass}
            list={`external-roles-${personId}`}
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
            placeholder="Es. Preparatore, Ricerca e reclutamento allievi"
          />
          <datalist id={`external-roles-${personId}`}>
            {EXTERNAL_ROLE_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
      )}
      <label className="block text-xs font-medium text-slate-600">
        {modulesLabel}
        <textarea
          className={inputClass + ' h-16 py-1'}
          value={modules}
          onChange={(e) => setModules(e.target.value)}
          placeholder={
            isTeacher
              ? 'Es. ACCOGLIENZA; REDAZIONE TESTI E COMUNICAZIONI FORMALI'
              : role === 'tutor'
                ? 'Es. Tutoraggio d’aula e FAD'
                : isExternal
                  ? 'Es. Ricerca dei candidati e colloqui di selezione'
                  : 'Es. Segreteria, rendicontazione'
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-slate-600">
          Ore
          <input className={inputClass} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          € all'ora
          <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <PrimaryButton type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => setOpen(false)}>
          Annulla
        </SecondaryButton>
      </div>
    </div>
  )
}
