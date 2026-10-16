import { useEffect, useState } from 'react'
import type { DocumentRow } from '../types/db'
import { documentPreviewKind } from '../lib/documentFileTypes'
import { getPreviewUrl } from '../services/documents'
import { Modal } from './Modal'

interface Props {
  doc: DocumentRow
  onClose: () => void
}

export function DocumentPreview({ doc, onClose }: Props) {
  const kind = documentPreviewKind(doc.file_name, doc.mime_type)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [textInFrame, setTextInFrame] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setUrl('')
    setText('')
    setTextInFrame(false)
    setError('')
    if (!kind) {
      setError('Questo formato non si apre in anteprima.')
      return
    }
    getPreviewUrl(doc)
      .then(async (signed) => {
        if (cancelled) return
        if (kind === 'text') {
          try {
            const response = await fetch(signed)
            if (!response.ok) throw new Error('Anteprima non disponibile')
            const body = await response.text()
            if (cancelled) return
            setText(body)
          } catch {
            if (cancelled) return
            setTextInFrame(true)
          }
        }
        if (!cancelled) setUrl(signed)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Anteprima non disponibile')
      })
    return () => {
      cancelled = true
    }
  }, [doc, kind])

  return (
    <Modal title={doc.title || doc.file_name} onClose={onClose} wide>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !url && <p className="text-sm text-slate-400">Apertura…</p>}
      {url && kind === 'image' && (
        <img
          src={url}
          alt={doc.file_name}
          className="mx-auto max-h-[70vh] max-w-full object-contain"
        />
      )}
      {url && kind === 'pdf' && (
        <iframe
          title={doc.file_name}
          src={url}
          className="h-[70vh] w-full rounded-lg border border-slate-200"
        />
      )}
      {url && kind === 'html' && (
        <iframe
          title={doc.file_name}
          src={url}
          sandbox="allow-scripts"
          className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
        />
      )}
      {url && kind === 'text' && textInFrame && (
        <iframe
          title={doc.file_name}
          src={url}
          sandbox=""
          className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
        />
      )}
      {url && kind === 'text' && !textInFrame && (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {text}
        </pre>
      )}
    </Modal>
  )
}
