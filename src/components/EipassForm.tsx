import { useState, type FormEvent } from 'react'
import type { EipassCandidate, EipassCandidateInput } from '../types/db'
import { calendarDateIso } from '../lib/studentDocumentStatus'
import { invoiceStatusLabels, paymentMethods } from '../lib/eipassInvoice'
import { TextField, SelectField, TextAreaField } from './Field'
import { PrimaryButton, SecondaryButton } from './Buttons'

const empty: EipassCandidateInput = {
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
  doc_type: '',
  doc_number: '',
  doc_expiry_date: null,
  certification: '',
  purchase_date: null,
  exam_done: false,
  exam_date: null,
  amount: null,
  vat_rate: 22,
  payment_method: '',
  payment_date: null,
  invoice_status: 'da_fatturare',
  invoice_number: '',
  invoice_date: null,
  notes: '',
}

interface Props {
  initial?: EipassCandidate
  /** Numero proposto quando si compila la fattura a mano. */
  suggestInvoiceNumber?: () => string
  onSave: (input: EipassCandidateInput) => Promise<void>
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

export function EipassForm({ initial, suggestInvoiceNumber, onSave, onCancel }: Props) {
  const [form, setForm] = useState<EipassCandidateInput>(() => ({
    ...empty,
    purchase_date: initial ? null : calendarDateIso(),
    ...initial,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof EipassCandidateInput>(key: K, value: EipassCandidateInput[K]) {
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
      <Section title="Acquisto ed esame">
        <TextField
          label="Data di acquisto"
          type="date"
          value={form.purchase_date ?? ''}
          onChange={(e) => set('purchase_date', e.target.value || null)}
        />
        <TextField
          label="Certificazione acquistata"
          value={form.certification}
          onChange={(e) => set('certification', e.target.value)}
          placeholder="Es. EIPASS 7 Moduli User"
        />
        <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-end">
          <label className="flex h-10 items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              checked={form.exam_done}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  exam_done: e.target.checked,
                  exam_date: e.target.checked ? f.exam_date : null,
                }))
              }
            />
            Esame fatto
          </label>
          {form.exam_done && (
            <div className="min-w-0 flex-1">
              <TextField
                label="Data esame"
                type="date"
                value={form.exam_date ?? ''}
                onChange={(e) => set('exam_date', e.target.value || null)}
              />
            </div>
          )}
        </div>
      </Section>

      <Section title="Pagamento e fatturazione">
        <TextField
          label="Importo pagato (€, IVA inclusa)"
          type="number"
          min="0"
          step="0.01"
          value={form.amount ?? ''}
          onChange={(e) => set('amount', e.target.value === '' ? null : Number(e.target.value))}
        />
        <SelectField
          label="Modalità di pagamento"
          value={form.payment_method}
          onChange={(e) => set('payment_method', e.target.value)}
        >
          <option value="">—</option>
          {paymentMethods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Data di pagamento"
          type="date"
          value={form.payment_date ?? ''}
          onChange={(e) => set('payment_date', e.target.value || null)}
        />
        <SelectField
          label="IVA"
          value={String(form.vat_rate)}
          onChange={(e) => set('vat_rate', Number(e.target.value))}
          hint="Usata per generare la fattura elettronica"
        >
          <option value="22">22%</option>
          <option value="0">Esente art. 10 (N4)</option>
        </SelectField>
        <SelectField
          label="Fattura"
          value={form.invoice_status}
          onChange={(e) => set('invoice_status', e.target.value as EipassCandidateInput['invoice_status'])}
        >
          {Object.entries(invoiceStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        {form.invoice_status !== 'non_richiesta' && (
          <>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <TextField
                  label="Numero fattura"
                  value={form.invoice_number}
                  onChange={(e) => set('invoice_number', e.target.value)}
                  placeholder="Es. 12"
                />
              </div>
              {suggestInvoiceNumber && !form.invoice_number && (
                <SecondaryButton
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      invoice_number: suggestInvoiceNumber(),
                      invoice_date: f.invoice_date ?? calendarDateIso(),
                    }))
                  }
                >
                  Successivo
                </SecondaryButton>
              )}
            </div>
            <TextField
              label="Data fattura"
              type="date"
              value={form.invoice_date ?? ''}
              onChange={(e) => set('invoice_date', e.target.value || null)}
            />
          </>
        )}
      </Section>

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

      <Section title="Documento d'identità">
        <SelectField label="Tipo documento" value={form.doc_type} onChange={(e) => set('doc_type', e.target.value)}>
          <option value="">—</option>
          <option value="Carta d'identità">Carta d'identità</option>
          <option value="Passaporto">Passaporto</option>
          <option value="Patente">Patente</option>
          <option value="Permesso di soggiorno">Permesso di soggiorno</option>
        </SelectField>
        <TextField label="Numero" value={form.doc_number} onChange={(e) => set('doc_number', e.target.value.toUpperCase())} />
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
