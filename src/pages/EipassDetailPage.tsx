import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { EipassCandidate, EipassCandidateInput } from '../types/db'
import {
  deleteEipassCandidate,
  getEipassCandidate,
  listEipassCandidates,
  updateEipassCandidate,
} from '../services/eipass'
import { hasDocumentInCategory } from '../services/documents'
import { fmtDate, fullName } from '../lib/format'
import { calendarDateIso, checkStudentDocuments } from '../lib/studentDocumentStatus'
import {
  buildEipassInvoiceXml,
  invoiceAmounts,
  invoiceFileName,
  invoiceMissingFields,
  nextInvoiceNumber,
  paymentMethodLabel,
  randomProgressive,
} from '../lib/eipassInvoice'
import { downloadBlob } from '../lib/downloadBlob'
import { suggestNextInvoiceNumber } from '../services/invoiceNumbering'
import { findInvoiceForEipassCandidate } from '../services/invoices'
import { EipassForm } from '../components/EipassForm'
import { EipassExamBadge, InvoiceStatusBadge } from '../components/EipassExamBadge'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { DangerButton, SecondaryButton } from '../components/Buttons'
import { EmailLink, WhatsAppLink } from '../components/ContactLinks'

export function EipassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState<EipassCandidate | null>(null)
  const [editing, setEditing] = useState(false)
  const [hasIdentityFile, setHasIdentityFile] = useState<boolean | null>(null)
  const [savingExam, setSavingExam] = useState(false)
  const [hasCertificate, setHasCertificate] = useState(false)
  const [allCandidates, setAllCandidates] = useState<EipassCandidate[]>([])
  const [invoiceError, setInvoiceError] = useState('')
  const [invoiceInfo, setInvoiceInfo] = useState('')
  const [suggestedNumber, setSuggestedNumber] = useState('')
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null)

  function refreshIdentity(candidateId: string) {
    hasDocumentInCategory('eipass', candidateId, 'identity')
      .then(setHasIdentityFile)
      .catch(() => setHasIdentityFile(false))
    hasDocumentInCategory('eipass', candidateId, 'certificate')
      .then(setHasCertificate)
      .catch(() => setHasCertificate(false))
  }

  useEffect(() => {
    if (!id) return
    getEipassCandidate(id).then(setCandidate)
    findInvoiceForEipassCandidate(id)
      .then(setLinkedInvoiceId)
      .catch(() => setLinkedInvoiceId(null))
    listEipassCandidates().then(setAllCandidates)
    suggestNextInvoiceNumber(new Date().getFullYear())
      .then((r) => setSuggestedNumber(r.number))
      .catch(() => setSuggestedNumber(''))
    setHasIdentityFile(null)
    refreshIdentity(id)
  }, [id])

  if (!id || !candidate) return <p className="text-slate-400">Caricamento…</p>

  async function handleSave(input: EipassCandidateInput) {
    setCandidate(await updateEipassCandidate(id!, input))
    setEditing(false)
  }

  async function toggleExam() {
    if (!candidate) return
    setSavingExam(true)
    try {
      const done = !candidate.exam_done
      setCandidate(
        await updateEipassCandidate(id!, {
          exam_done: done,
          exam_date: done ? candidate.exam_date : null,
        }),
      )
    } finally {
      setSavingExam(false)
    }
  }

  function suggestInvoiceNumber(): string {
    const today = calendarDateIso()
    return (
      suggestedNumber ||
      nextInvoiceNumber(
        allCandidates.filter((c) => c.id !== id),
        Number(today.slice(0, 4)),
      )
    )
  }

  /**
   * Numero automatico dal registro fatture (create nell'app o importate da Aruba) e dalle
   * fatture EIPASS: ricalcolato al momento per non duplicare numeri.
   */
  async function autoInvoiceNumber(): Promise<string> {
    const year = Number(calendarDateIso().slice(0, 4))
    const { number } = await suggestNextInvoiceNumber(year)
    setSuggestedNumber(number)
    return number
  }

  async function handleInvoiceXml() {
    if (!candidate) return
    setInvoiceError('')
    setInvoiceInfo('')
    let current = candidate
    const missing = invoiceMissingFields({
      ...current,
      invoice_number: current.invoice_number || 'auto',
      invoice_date: current.invoice_date ?? calendarDateIso(),
    })
    if (missing.length) {
      setInvoiceError(`Per generare la fattura mancano: ${missing.join(', ')}`)
      return
    }
    try {
      // Numero e data proposti in automatico se non ancora assegnati
      if (!current.invoice_number.trim() || !current.invoice_date) {
        current = await updateEipassCandidate(id!, {
          invoice_number: current.invoice_number.trim() || (await autoInvoiceNumber()),
          invoice_date: current.invoice_date ?? calendarDateIso(),
        })
        setCandidate(current)
      }
      const progressive = randomProgressive()
      downloadBlob(
        new Blob([buildEipassInvoiceXml(current, progressive)], { type: 'application/xml' }),
        invoiceFileName(progressive),
      )
      setInvoiceInfo(
        `Fattura n. ${current.invoice_number} scaricata: caricala su Aruba (Fatture emesse → Carica fattura).`,
      )
      if (
        current.invoice_status !== 'fatturato' &&
        window.confirm(
          `Fattura n. ${current.invoice_number} scaricata. Caricala su Aruba Fatturazione Elettronica. Segnare il corsista come «Fatturato»?`,
        )
      ) {
        setCandidate(await updateEipassCandidate(id!, { invoice_status: 'fatturato' }))
      }
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Errore nella generazione della fattura')
    }
  }

  async function handleDelete() {
    if (!window.confirm('Eliminare questo corsista EIPASS e i documenti caricati?')) return
    await deleteEipassCandidate(id!)
    navigate('/eipass')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/eipass" className="text-xs text-indigo-600 hover:underline">
            ← EIPASS privato
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">{fullName(candidate)}</h1>
            <EipassExamBadge candidate={candidate} />
            {hasIdentityFile !== null && (
              <DocumentStatusBadge check={checkStudentDocuments(candidate, hasIdentityFile)} personName={fullName(candidate)} />
            )}
            {hasCertificate && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Attestato caricato
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && <SecondaryButton onClick={() => setEditing(true)}>Modifica</SecondaryButton>}
          <DangerButton onClick={() => void handleDelete()}>Elimina</DangerButton>
        </div>
      </div>

      {editing ? (
        <EipassForm
          initial={candidate}
          suggestInvoiceNumber={suggestInvoiceNumber}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-4">
          <InfoCard title="Acquisto ed esame">
            <Info label="Data di acquisto" value={fmtDate(candidate.purchase_date)} />
            <Info label="Certificazione" value={candidate.certification} />
            <Info label="Esame">
              <div className="flex flex-wrap items-center gap-2">
                <EipassExamBadge candidate={candidate} />
                {candidate.exam_done && candidate.exam_date && (
                  <span className="text-xs text-slate-500">il {fmtDate(candidate.exam_date)}</span>
                )}
                <SecondaryButton size="sm" disabled={savingExam} onClick={() => void toggleExam()}>
                  {candidate.exam_done ? 'Segna da fare' : 'Segna esame fatto'}
                </SecondaryButton>
              </div>
            </Info>
          </InfoCard>
          <InfoCard title="Pagamento e fatturazione">
            <Info
              label="Importo pagato"
              value={
                candidate.amount != null
                  ? `${candidate.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}${
                      candidate.vat_rate === 0
                        ? ' (esente IVA)'
                        : ` (imponibile ${invoiceAmounts(candidate.amount, candidate.vat_rate).taxable.toLocaleString('it-IT', { minimumFractionDigits: 2 })} + IVA ${candidate.vat_rate}%)`
                    }`
                  : ''
              }
            />
            <Info
              label="Pagamento"
              value={[paymentMethodLabel(candidate.payment_method), candidate.payment_date && `il ${fmtDate(candidate.payment_date)}`]
                .filter(Boolean)
                .join(' ')}
            />
            <Info label="Fattura">
              <div className="flex flex-wrap items-center gap-2">
                <InvoiceStatusBadge status={candidate.invoice_status} />
                {candidate.invoice_number && (
                  <span className="text-xs text-slate-500">
                    n. {candidate.invoice_number}
                    {candidate.invoice_date && ` del ${fmtDate(candidate.invoice_date)}`}
                  </span>
                )}
                {linkedInvoiceId && (
                  <Link to={`/fatturazione/${linkedInvoiceId}`} className="text-xs font-medium text-indigo-600 hover:underline">
                    Apri fattura
                  </Link>
                )}
              </div>
            </Info>
            {candidate.invoice_status !== 'non_richiesta' && (
              <div className="col-span-full space-y-2">
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton size="sm" onClick={() => void handleInvoiceXml()}>
                    Scarica XML per Aruba
                  </SecondaryButton>
                </div>
                {invoiceMissingFields({
                  ...candidate,
                  invoice_number: candidate.invoice_number || 'auto',
                  invoice_date: candidate.invoice_date ?? calendarDateIso(),
                }).length > 0 && (
                  <p className="text-xs text-amber-700">
                    Per la fattura servono:{' '}
                    {invoiceMissingFields({
                      ...candidate,
                      invoice_number: candidate.invoice_number || 'auto',
                      invoice_date: candidate.invoice_date ?? calendarDateIso(),
                    }).join(', ')}
                    . Usa Modifica per completarli.
                  </p>
                )}
                {invoiceError && <p className="text-xs text-red-600">{invoiceError}</p>}
                {invoiceInfo && <p className="text-xs text-emerald-700">{invoiceInfo}</p>}
              </div>
            )}
          </InfoCard>
          <InfoCard title="Anagrafica">
            <Info label="Codice fiscale" value={candidate.tax_code} />
            <Info
              label="Nato/a"
              value={`${fmtDate(candidate.birth_date)} ${candidate.birth_place ? `a ${candidate.birth_place}` : ''}`}
            />
            <Info label="Sesso" value={candidate.gender} />
            <Info
              label="Indirizzo"
              value={[candidate.address, candidate.postal_code, candidate.city, candidate.province]
                .filter(Boolean)
                .join(', ')}
            />
            <Info label="Telefono">
              <WhatsAppLink value={candidate.phone} />
            </Info>
            <Info label="Email">
              <EmailLink value={candidate.email} />
            </Info>
          </InfoCard>
          <InfoCard title="Documento d'identità (dati)">
            <Info label="Tipo" value={candidate.doc_type} />
            <Info label="Numero" value={candidate.doc_number} />
            <Info label="Scadenza" value={fmtDate(candidate.doc_expiry_date)} />
          </InfoCard>
          {candidate.notes && (
            <InfoCard title="Note">
              <p className="col-span-full text-sm text-slate-600">{candidate.notes}</p>
            </InfoCard>
          )}
        </div>
      )}

      <p className="text-sm text-slate-500">
        Carica qui documento d'identità e copia dell'<strong>attestato</strong> (categoria Attestato).
      </p>
      <DocumentsPanel mode="eipass" personId={id} onChanged={() => refreshIdentity(id)} />
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  )
}

function Info({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-xs text-slate-400">{label}</p>
      {children != null ? (
        <div className="text-sm font-medium text-slate-700">{children}</div>
      ) : (
        <p className="text-sm font-medium text-slate-700">{value?.trim() || '—'}</p>
      )}
    </div>
  )
}
