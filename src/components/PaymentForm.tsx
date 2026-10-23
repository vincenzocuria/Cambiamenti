import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { SelectField, TextField } from './Field'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { formatEuro } from '../lib/euroInWords'
import { createCoursePayment } from '../services/payments'
import { parseEuroInput } from '../lib/paymentsSummary'
import { calendarDateIso } from '../lib/studentDocumentStatus'
import type { CoursePaymentDirection, CoursePaymentKind, CourseStaffRole } from '../types/db'

export interface PaymentFormTarget {
  courseId: string
  courseLabel: string
  direction: CoursePaymentDirection
  /** Solo per i compensi al personale. */
  personId?: string
  personName?: string
  role?: CourseStaffRole
  /** Importo proposto: saldo da ricevere o compenso da erogare. */
  suggested: number
}

// Giorno locale (non UTC): dopo mezzanotte in Italia non propone la data di ieri
const today = () => calendarDateIso()

/** Registra un incasso dalla Regione o un compenso pagato al personale. */
export function PaymentForm({
  target,
  onClose,
  onSaved,
}: {
  target: PaymentFormTarget
  onClose: () => void
  onSaved: () => void
}) {
  const incoming = target.direction === 'in'
  const [kind, setKind] = useState<CoursePaymentKind>(incoming ? 'saldo' : 'compenso')
  const [amount, setAmount] = useState(target.suggested > 0 ? formatEuro(target.suggested) : '')
  const [paidOn, setPaidOn] = useState(today())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = parseEuroInput(amount)
    if (value == null || value <= 0) {
      setError('Inserisci un importo maggiore di zero.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createCoursePayment({
        course_id: target.courseId,
        direction: target.direction,
        kind,
        person_id: target.personId ?? null,
        role: target.role ?? null,
        amount: value,
        paid_on: paidOn || today(),
        reference,
        notes,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito')
      setSaving(false)
    }
  }

  const title = incoming ? 'Registra incasso dalla Regione' : 'Registra compenso erogato'

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-slate-600">
          {target.courseLabel}
          {target.personName ? ` · ${target.personName}` : ''}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {incoming ? (
            <SelectField
              label="Tipo"
              value={kind}
              onChange={(e) => setKind(e.target.value as CoursePaymentKind)}
            >
              <option value="saldo">Saldo</option>
              <option value="anticipo">Anticipo</option>
              <option value="altro">Altro</option>
            </SelectField>
          ) : (
            <SelectField
              label="Tipo"
              value={kind}
              onChange={(e) => setKind(e.target.value as CoursePaymentKind)}
            >
              <option value="compenso">Compenso</option>
              <option value="anticipo">Acconto</option>
              <option value="altro">Altro</option>
            </SelectField>
          )}
          <TextField
            label="Importo (€)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <TextField
            label={incoming ? 'Data incasso' : 'Data pagamento'}
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            required
          />
          <TextField
            label="Riferimento"
            placeholder={incoming ? 'Mandato, decreto…' : 'Bonifico, CRO…'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <TextField label="Note" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {incoming && (
          <p className="text-xs text-slate-500">
            Le note di debito segnate come incassate su Aruba sono già contate: registra qui solo
            gli incassi che non passano da una nota.
          </p>
        )}
        {incoming && kind === 'anticipo' && (
          <p className="text-xs text-slate-500">
            L’anticipo non riduce il saldo da ricevere del verbale, che lo ha già detratto.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton type="button" onClick={onClose}>
            Annulla
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? 'Salvataggio…' : 'Registra'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}
