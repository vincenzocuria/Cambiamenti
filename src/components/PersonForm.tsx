import { useMemo, useState, type FormEvent } from 'react'
import type { Person, PersonInput, PersonType } from '../types/db'
import { inpsBenefitOptions } from '../data/inpsBenefits'
import { deriveBankInfo, normalizeIban } from '../lib/iban'
import { TextField, SelectField, TextAreaField } from './Field'
import { PasswordField } from './PasswordField'
import { PrimaryButton, SecondaryButton } from './Buttons'

const empty: PersonInput = {
  first_name: '',
  last_name: '',
  birth_date: null,
  birth_place: '',
  tax_code: '',
  gender: '',
  address: '',
  city: '',
  postal_code: '',
  province: '',
  phone: '',
  email: '',
  fad_email: '',
  fad_password: '',
  iban: '',
  bank_name: '',
  bic: '',
  doc_type: '',
  doc_number: '',
  doc_issued_by: '',
  doc_issue_date: null,
  doc_expiry_date: null,
  notes: '',
  inps_benefit: '',
}

interface Props {
  initial?: Person
  personType?: PersonType
  onSave: (input: PersonInput) => Promise<void>
  onCancel: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
      <legend className="px-2 text-sm font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  )
}

export function PersonForm({ initial, personType, onSave, onCancel }: Props) {
  const [form, setForm] = useState<PersonInput>(() => ({
    ...empty,
    ...initial,
    inps_benefit: initial?.inps_benefit ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isStudent = personType === 'student'

  function set<K extends keyof PersonInput>(key: K, value: PersonInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const ibanInfo = useMemo(() => (form.iban ? deriveBankInfo(form.iban) : null), [form.iban])

  function handleIbanChange(raw: string) {
    const iban = normalizeIban(raw)
    const info = deriveBankInfo(iban)
    setForm((f) => ({
      ...f,
      iban,
      // Compila banca e BIC solo se ricavati dall'archivio ABI; restano modificabili
      bank_name: info.valid && info.bankName ? info.bankName : f.bank_name,
      bic: info.valid && info.bic ? info.bic : f.bic,
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.iban && !ibanInfo?.valid) {
      setError("L'IBAN inserito non è valido (controllo cifre errato)")
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

  const ibanHint = !form.iban
    ? undefined
    : !ibanInfo?.valid
      ? 'IBAN non valido'
      : ibanInfo.bankName
        ? `ABI ${ibanInfo.abi} · CAB ${ibanInfo.cab} — ${ibanInfo.bankName}`
        : ibanInfo.abi
          ? `IBAN valido · ABI ${ibanInfo.abi} non in archivio: inserisci banca e BIC a mano`
          : 'IBAN estero valido: inserisci banca e BIC a mano'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Section title="Anagrafica">
        <TextField label="Cognome *" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        <TextField label="Nome *" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <SelectField label="Sesso" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">—</option>
          <option value="M">M</option>
          <option value="F">F</option>
        </SelectField>
        <TextField label="Data di nascita" type="date" value={form.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value || null)} />
        <TextField label="Luogo di nascita" value={form.birth_place} onChange={(e) => set('birth_place', e.target.value)} />
        <TextField label="Codice fiscale" value={form.tax_code} onChange={(e) => set('tax_code', e.target.value.toUpperCase())} maxLength={16} />
        <TextField label="Indirizzo" value={form.address} onChange={(e) => set('address', e.target.value)} />
        <TextField label="Città" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <TextField label="CAP" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} maxLength={5} />
        <TextField label="Provincia" value={form.province} onChange={(e) => set('province', e.target.value.toUpperCase())} maxLength={2} />
        <TextField label="Telefono" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <TextField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </Section>

      <Section title="Credenziali FAD">
        <TextField
          label="Email FAD"
          type="email"
          value={form.fad_email}
          onChange={(e) => set('fad_email', e.target.value)}
          hint="Se vuota, nei documenti si usa l’email anagrafica"
        />
        <PasswordField
          label="Password FAD"
          value={form.fad_password}
          onChange={(e) => set('fad_password', e.target.value)}
          autoComplete="new-password"
          hint="Credenziali della piattaforma e-learning (non del gestionale)"
        />
      </Section>

      {isStudent && (
        <Section title="Prestazione / trattamento INPS">
          <SelectField
            label="Categoria"
            value={form.inps_benefit}
            onChange={(e) => set('inps_benefit', e.target.value)}
            hint="Usata nei moduli GOL (es. Allegato 1.c)"
          >
            <option value="">— Non specificata —</option>
            {inpsBenefitOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        </Section>
      )}

      <Section title="Coordinate bancarie">
        <TextField
          label="IBAN"
          value={form.iban}
          onChange={(e) => handleIbanChange(e.target.value)}
          hint={ibanHint}
          maxLength={34}
          placeholder="IT60X0542811101000000123456"
        />
        <TextField label="Banca" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
        <TextField label="BIC / SWIFT" value={form.bic} onChange={(e) => set('bic', e.target.value.toUpperCase())} maxLength={11} />
      </Section>

      <Section title="Documento d'identità">
        <SelectField label="Tipo documento" value={form.doc_type} onChange={(e) => set('doc_type', e.target.value)}>
          <option value="">—</option>
          <option value="Carta d'identità">Carta d'identità</option>
          <option value="Passaporto">Passaporto</option>
          <option value="Patente">Patente</option>
          <option value="Permesso di soggiorno">Permesso di soggiorno</option>
        </SelectField>
        <TextField label="Numero" value={form.doc_number} onChange={(e) => set('doc_number', e.target.value.toUpperCase())} />
        <TextField label="Rilasciato da" value={form.doc_issued_by} onChange={(e) => set('doc_issued_by', e.target.value)} />
        <TextField label="Data rilascio" type="date" value={form.doc_issue_date ?? ''} onChange={(e) => set('doc_issue_date', e.target.value || null)} />
        <TextField label="Data scadenza" type="date" value={form.doc_expiry_date ?? ''} onChange={(e) => set('doc_expiry_date', e.target.value || null)} />
      </Section>

      <TextAreaField label="Note" value={form.notes} onChange={(e) => set('notes', e.target.value)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          Annulla
        </SecondaryButton>
      </div>
    </form>
  )
}
