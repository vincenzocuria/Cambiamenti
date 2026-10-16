import { useState } from 'react'
import {
  studentDocumentGapLabels,
  studentDocumentStatusLabel,
  type StudentDocumentCheck,
  type StudentDocumentGap,
} from '../lib/studentDocumentStatus'
import { Modal } from './Modal'

/** Cosa fare per sistemare ciascuna mancanza. */
const gapHints: Record<StudentDocumentGap, string> = {
  file: "Carica il documento d'identità nella sezione Documenti della scheda, categoria «Documento d'identità».",
  dati: 'Compila tipo e numero del documento con «Modifica» nella scheda.',
  scadenza: 'Inserisci la data di scadenza del documento con «Modifica» nella scheda.',
  scaduto: 'Carica il documento nuovo e aggiorna numero e scadenza con «Modifica».',
  curriculum: 'Carica il curriculum nella sezione Documenti della scheda, categoria «Curriculum».',
}

export function DocumentStatusBadge({
  check,
  personName,
}: {
  check: StudentDocumentCheck
  /** Nome mostrato nel titolo del riquadro con le mancanze. */
  personName?: string
}) {
  const [open, setOpen] = useState(false)
  const label = studentDocumentStatusLabel(check)
  const className = `inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
    check.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
  }`
  if (check.ok) return <span className={className}>{label}</span>

  return (
    <>
      <button
        type="button"
        title="Vedi cosa manca"
        className={`${className} cursor-pointer underline decoration-dotted underline-offset-2 hover:bg-amber-100`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {label}
      </button>
      {open && (
        <Modal title={personName ? `Cosa manca a ${personName}` : 'Cosa manca'} onClose={() => setOpen(false)}>
          <ul className="space-y-3 text-sm">
            {check.gaps.map((gap) => (
              <li key={gap} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="font-medium text-amber-900">{studentDocumentGapLabels[gap]}</p>
                <p className="mt-1 text-slate-700">{gapHints[gap]}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">Tutto il resto è in regola.</p>
        </Modal>
      )}
    </>
  )
}
