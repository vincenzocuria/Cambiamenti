import { useState, type FormEvent } from 'react'
import {
  courseStatuses,
  courseStatusMeta,
  defaultCourseStatus,
} from '../data/courseStatus'
import type { Course, CourseInput } from '../types/db'
import { TextField, SelectField, TextAreaField } from './Field'
import { PrimaryButton, SecondaryButton } from './Buttons'

const empty: CourseInput = {
  name: '',
  edition: '',
  code: '',
  cup: '',
  notes: '',
  status: defaultCourseStatus,
  start_date: null,
  end_date: null,
  duration_hours: null,
}

interface Props {
  initial?: Course
  onSave: (input: CourseInput) => Promise<void>
  onCancel: () => void
}

export function CourseForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<CourseInput>(initial ?? empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof CourseInput>(key: K, value: CourseInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Nome corso *"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <TextField
          label="Edizione"
          value={form.edition}
          onChange={(e) => set('edition', e.target.value)}
        />
        <TextField label="Codice" value={form.code} onChange={(e) => set('code', e.target.value)} />
        <TextField label="CUP" value={form.cup} onChange={(e) => set('cup', e.target.value)} />
        <SelectField
          label="Stato *"
          required
          value={form.status}
          onChange={(e) => set('status', e.target.value as CourseInput['status'])}
          hint="Ciclo Regione Calabria fino a Esito chiuso."
        >
          {courseStatuses.map((s) => (
            <option key={s} value={s}>
              {courseStatusMeta[s].label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Data inizio"
          type="date"
          value={form.start_date ?? ''}
          onChange={(e) => set('start_date', e.target.value || null)}
        />
        <TextField
          label="Data fine"
          type="date"
          value={form.end_date ?? ''}
          onChange={(e) => set('end_date', e.target.value || null)}
        />
        <TextField
          label="Durata (ore)"
          type="number"
          min={0}
          step={0.5}
          value={form.duration_hours ?? ''}
          onChange={(e) => set('duration_hours', e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
      <TextAreaField label="Note" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva corso'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          Annulla
        </SecondaryButton>
      </div>
    </form>
  )
}
