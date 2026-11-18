import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { PrimaryButton, SecondaryButton, DangerButton } from './Buttons'
import { SelectField, TextAreaField, TextField } from './Field'
import {
  contractPhase,
  contractWarnings,
  emptyContract,
  phaseLabels,
  rolesShort,
  statusLabels,
  type CollaborationContract,
  type ContractInput,
  type ContractStatus,
} from '../lib/collaborationContract'
import { formatEuro } from '../lib/euroInWords'
import { fmtDate } from '../lib/format'
import {
  attachSignedContract,
  createContract,
  deleteContract,
  generateContractDocument,
  listContracts,
  openContractDocument,
  updateContract,
} from '../services/collaborationContracts'
import type { Person } from '../types/db'

const phaseTone: Record<ReturnType<typeof contractPhase>, string> = {
  futuro: 'bg-slate-100 text-slate-600',
  in_corso: 'bg-emerald-50 text-emerald-700',
  in_scadenza: 'bg-amber-50 text-amber-700',
  scaduto: 'bg-red-50 text-red-700',
  chiuso: 'bg-slate-100 text-slate-500',
}

function toInput(c: CollaborationContract): ContractInput {
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    person: _p,
    signed_document_id: _s,
    generated_document_id: _g,
    ...rest
  } = c
  return rest
}

export function ContractForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ContractInput
  onSave: (input: ContractInput) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ContractInput>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ContractInput>(k: K, v: ContractInput[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const warnings = contractWarnings(draft)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.role_tutor && !draft.role_direction && !draft.role_admin) {
      setError('Scegli almeno un’attività.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const check = (k: 'role_tutor' | 'role_direction' | 'role_admin', label: string) => (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={draft[k]} onChange={(e) => set(k, e.target.checked)} />
      {label}
    </label>
  )

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">Attività affidate</span>
        <div className="flex flex-wrap gap-4">
          {check('role_tutor', 'Tutor')}
          {check('role_direction', 'Direzione')}
          {check('role_admin', 'Amministrazione')}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Dal" type="date" required value={draft.start_date} onChange={(e) => set('start_date', e.target.value)} />
        <TextField label="Al" type="date" value={draft.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} />
        <TextField
          label="Compenso lordo (€)"
          type="number"
          step="0.01"
          min="0"
          value={draft.gross_amount ?? ''}
          onChange={(e) => set('gross_amount', e.target.value === '' ? null : Number(e.target.value))}
        />
        <TextField
          label="Preavviso recesso (giorni)"
          type="number"
          min="0"
          max="365"
          value={draft.notice_days ?? ''}
          onChange={(e) => set('notice_days', e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Corsi oggetto dell'incarico"
          placeholder="es. EIPASS 7 – EIPASS USER – SKILLS FOR GREEN"
          value={draft.courses_text}
          onChange={(e) => set('courses_text', e.target.value)}
        />
        <TextField label="Sede di svolgimento" value={draft.location} onChange={(e) => set('location', e.target.value)} />
        <TextField label="Modalità di pagamento" value={draft.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} />
        <TextField
          label="Ruolo privacy sui dati dei corsisti"
          hint="es. soggetto autorizzato al trattamento / responsabile del trattamento"
          value={draft.privacy_role}
          onChange={(e) => set('privacy_role', e.target.value)}
        />
      </div>
      <TextAreaField
        label="Ulteriori attività specifiche (facoltativo)"
        rows={2}
        value={draft.extra_activities}
        onChange={(e) => set('extra_activities', e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Data di firma" type="date" value={draft.signed_on ?? ''} onChange={(e) => set('signed_on', e.target.value || null)} />
        <SelectField label="Stato" value={draft.status} onChange={(e) => set('status', e.target.value as ContractStatus)}>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </SelectField>
      </div>
      <TextAreaField label="Note" rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      {warnings.length > 0 && (
        <p className="text-xs text-amber-700">Da completare prima di generare il contratto: {warnings.join(' ')}</p>
      )}
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

/** Sezione «Contratti di collaborazione» della scheda personale. */
export function ContractsPanel({ person, onDocumentsChanged }: { person: Person; onDocumentsChanged?: () => void }) {
  const [contracts, setContracts] = useState<CollaborationContract[]>([])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadFor = useRef<CollaborationContract | null>(null)

  const load = useCallback(() => {
    listContracts({ personId: person.id })
      .then(setContracts)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [person.id])

  useEffect(load, [load])

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function save(input: ContractInput, existing?: CollaborationContract) {
    if (existing) await updateContract(existing.id, input)
    else await createContract({ ...input, person_id: person.id })
    setEditing(null)
    load()
  }

  function generate(c: CollaborationContract) {
    const missing = contractWarnings(toInput(c))
    if (missing.length && !window.confirm(`Mancano alcuni dati (${missing.join(' ')}) e resteranno righe da compilare a mano. Generare lo stesso?`)) return
    void run(c.id, async () => {
      const { document } = await generateContractDocument(c, person)
      load()
      onDocumentsChanged?.()
      await openContractDocument(document.id)
    })
  }

  function pickSigned(c: CollaborationContract) {
    uploadFor.current = c
    fileInput.current?.click()
  }

  function onFile(file: File | undefined) {
    const c = uploadFor.current
    if (!file || !c) return
    void run(c.id, async () => {
      await attachSignedContract(c, file)
      load()
      onDocumentsChanged?.()
    })
  }

  function remove(c: CollaborationContract) {
    if (!window.confirm('Eliminare questo contratto? I documenti caricati restano tra i documenti della persona.')) return
    void run(c.id, async () => {
      await deleteContract(c.id)
      load()
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Contratti di collaborazione ({contracts.length})</h3>
        {editing !== 'new' && (
          <SecondaryButton size="sm" onClick={() => setEditing('new')}>
            + Nuovo contratto co.co.co.
          </SecondaryButton>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {editing === 'new' && (
        <div className="mb-3">
          <ContractForm initial={emptyContract(person.id)} onSave={(i) => save(i)} onCancel={() => setEditing(null)} />
        </div>
      )}
      {contracts.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-slate-400">
          Nessun contratto. Crealo qui e genera il testo da firmare dal modello co.co.co.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {contracts.map((c) => {
            const phase = contractPhase(c)
            return (
              <li key={c.id} className="py-3">
                {editing === c.id ? (
                  <ContractForm initial={toInput(c)} onSave={(i) => save(i, c)} onCancel={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-slate-800">
                        {fmtDate(c.start_date)} → {c.end_date ? fmtDate(c.end_date) : '…'}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${phaseTone[phase]}`}>
                          {phaseLabels[phase]}
                        </span>
                        <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {statusLabels[c.status]}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {rolesShort(c)}
                        {c.gross_amount != null && ` · € ${formatEuro(c.gross_amount)} lordi`}
                        {c.notice_days != null && ` · preavviso ${c.notice_days} gg`}
                      </p>
                      {c.courses_text && <p className="text-xs text-slate-500">Corsi: {c.courses_text}</p>}
                      {c.notes && <p className="text-xs text-slate-400">{c.notes}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.signed_document_id && (
                        <SecondaryButton size="sm" onClick={() => void run(c.id, () => openContractDocument(c.signed_document_id!))}>
                          Apri firmato
                        </SecondaryButton>
                      )}
                      {c.generated_document_id && (
                        <SecondaryButton size="sm" onClick={() => void run(c.id, () => openContractDocument(c.generated_document_id!))}>
                          Apri generato
                        </SecondaryButton>
                      )}
                      <SecondaryButton size="sm" disabled={busy === c.id} onClick={() => generate(c)}>
                        {busy === c.id ? 'Attendi…' : 'Genera contratto'}
                      </SecondaryButton>
                      <SecondaryButton size="sm" disabled={busy === c.id} onClick={() => pickSigned(c)}>
                        {c.signed_document_id ? 'Sostituisci firmato' : 'Carica firmato'}
                      </SecondaryButton>
                      <SecondaryButton size="sm" onClick={() => setEditing(c.id)}>
                        Modifica
                      </SecondaryButton>
                      <DangerButton onClick={() => remove(c)}>Elimina</DangerButton>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
