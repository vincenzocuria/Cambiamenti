import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { EipassCandidate, EipassCandidateInput } from '../types/db'
import {
  deleteEipassCandidate,
  getEipassCandidate,
  updateEipassCandidate,
} from '../services/eipass'
import { hasDocumentInCategory } from '../services/documents'
import { fmtDate, fullName } from '../lib/format'
import { checkStudentDocuments } from '../lib/studentDocumentStatus'
import { EipassForm } from '../components/EipassForm'
import { EipassExamBadge } from '../components/EipassExamBadge'
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

  function refreshIdentity(candidateId: string) {
    hasDocumentInCategory('eipass', candidateId, 'identity')
      .then(setHasIdentityFile)
      .catch(() => setHasIdentityFile(false))
  }

  useEffect(() => {
    if (!id) return
    getEipassCandidate(id).then(setCandidate)
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
              <DocumentStatusBadge check={checkStudentDocuments(candidate, hasIdentityFile)} />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && <SecondaryButton onClick={() => setEditing(true)}>Modifica</SecondaryButton>}
          <DangerButton onClick={() => void handleDelete()}>Elimina</DangerButton>
        </div>
      </div>

      {editing ? (
        <EipassForm initial={candidate} onSave={handleSave} onCancel={() => setEditing(false)} />
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
