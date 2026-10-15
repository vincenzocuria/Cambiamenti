import { useState, type FormEvent } from 'react'
import type { Customer, CustomerInput } from '../types/db'
import { TextField, TextAreaField } from './Field'
import { PrimaryButton, SecondaryButton } from './Buttons'

export const emptyCustomer: CustomerInput = {
  company_name: '',
  first_name: '',
  last_name: '',
  vat_number: '',
  tax_code: '',
  address: '',
  postal_code: '',
  city: '',
  province: '',
  country: 'IT',
  sdi_code: '0000000',
  pec: '',
  email: '',
  phone: '',
  notes: '',
}

interface Props {
  initial?: Customer
  onSave: (input: CustomerInput) => Promise<void>
  onCancel: () => void
}

export function CustomerForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<CustomerInput>(() => ({ ...emptyCustomer, ...initial }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() && !(form.first_name.trim() && form.last_name.trim())) {
      setError('Indica la ragione sociale oppure nome e cognome')
      return
    }
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <TextField
        label="Ragione sociale (aziende ed enti)"
        value={form.company_name}
        onChange={(e) => set('company_name', e.target.value)}
        hint="Per le persone fisiche lascia vuoto e compila nome e cognome."
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Nome" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <TextField label="Cognome" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        <TextField label="Partita IVA" value={form.vat_number} onChange={(e) => set('vat_number', e.target.value)} />
        <TextField
          label="Codice fiscale"
          value={form.tax_code}
          onChange={(e) => set('tax_code', e.target.value.toUpperCase())}
          maxLength={16}
        />
      </div>
      <TextField label="Indirizzo" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="CAP" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} maxLength={5} />
        <TextField label="Città" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <TextField
          label="Provincia"
          value={form.province}
          onChange={(e) => set('province', e.target.value.toUpperCase())}
          maxLength={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Codice destinatario SDI"
          value={form.sdi_code}
          onChange={(e) => set('sdi_code', e.target.value.toUpperCase())}
          maxLength={7}
          hint="0000000 per i privati o se usi la PEC"
        />
        <TextField label="PEC" type="email" value={form.pec} onChange={(e) => set('pec', e.target.value)} />
        <TextField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <TextField label="Telefono" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>
      <TextAreaField label="Note" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva cliente'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          Annulla
        </SecondaryButton>
      </div>
    </form>
  )
}
