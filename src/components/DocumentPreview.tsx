import { useEffect, useState } from 'react'
import type { DocumentRow } from '../types/db'
import { documentPreviewKind, type DocumentPreviewKind } from '../lib/documentFileTypes'
import { p7mSigners, unsignedFileName, unwrapP7m } from '../lib/p7m'
import { getPreviewUrl } from '../services/documents'
import { Modal } from './Modal'

interface Props {
  doc: DocumentRow
  onClose: () => void
}

type ShownKind = Exclude<DocumentPreviewKind, 'signed'>

interface Shown {
  kind: ShownKind | null
  url: string
  text: string
  textInFrame: boolean
  /** Solo per i file firmati: chi ha firmato e il nome del file originale. */
  signers?: string[]
  innerName?: string
}

const MIME_BY_KIND: Record<ShownKind, string> = {
  pdf: 'application/pdf',
  image: 'image/png',
  text: 'text/plain;charset=utf-8',
  html: 'text/html;charset=utf-8',
}

/** Tipo del file originale: dal nome (verbale.pdf.p7m → pdf) o dai primi byte. */
function innerKind(name: string, bytes: Uint8Array): ShownKind | null {
  const fromName = documentPreviewKind(name)
  if (fromName && fromName !== 'signed') return fromName
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 8))
  if (head.startsWith('%PDF')) return 'pdf'
  if (head.startsWith('\x89PNG') || head.startsWith('\xff\xd8\xff')) return 'image'
  if (head.startsWith('<?xml') || /\.xml$/i.test(name)) return 'text'
  return null
}

function imageMime(bytes: Uint8Array): string {
  return bytes[0] === 0xff ? 'image/jpeg' : 'image/png'
}

async function openSigned(doc: DocumentRow, signedUrl: string): Promise<Shown> {
  const response = await fetch(signedUrl)
  if (!response.ok) throw new Error('Anteprima non disponibile')
  const bytes = new Uint8Array(await response.arrayBuffer())
  const inner = unwrapP7m(bytes)
  if (!inner) throw new Error('Non riesco a leggere il contenuto del file firmato.')
  const innerName = unsignedFileName(doc.file_name)
  const signers = p7mSigners(bytes)
  const kind = innerKind(innerName, inner)
  const type = kind === 'image' ? imageMime(inner) : kind ? MIME_BY_KIND[kind] : 'application/octet-stream'
  const url = URL.createObjectURL(new Blob([inner as Uint8Array<ArrayBuffer>], { type }))
  const text = kind === 'text' ? new TextDecoder('utf-8').decode(inner) : ''
  return { kind, url, text, textInFrame: false, signers, innerName }
}

export function DocumentPreview({ doc, onClose }: Props) {
  const kind = documentPreviewKind(doc.file_name, doc.mime_type)
  const [shown, setShown] = useState<Shown | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let blobUrl = ''
    setShown(null)
    setError('')
    if (!kind) {
      setError('Questo formato non si apre in anteprima.')
      return
    }
    getPreviewUrl(doc)
      .then(async (signed) => {
        if (cancelled) return
        if (kind === 'signed') {
          const result = await openSigned(doc, signed)
          blobUrl = result.url
          if (cancelled) URL.revokeObjectURL(blobUrl)
          else setShown(result)
          return
        }
        let text = ''
        let textInFrame = false
        if (kind === 'text') {
          try {
            const response = await fetch(signed)
            if (!response.ok) throw new Error('Anteprima non disponibile')
            text = await response.text()
          } catch {
            textInFrame = true
          }
        }
        if (!cancelled) setShown({ kind, url: signed, text, textInFrame })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Anteprima non disponibile')
      })
    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [doc, kind])

  const url = shown?.url ?? ''
  const shownKind = shown?.kind ?? null

  return (
    <Modal title={doc.title || doc.file_name} onClose={onClose} wide>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !shown && <p className="text-sm text-slate-400">Apertura…</p>}
      {shown?.innerName !== undefined && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="font-medium">
            Firmato digitalmente
            {shown.signers && shown.signers.length > 0 ? ` da ${shown.signers.join(', ')}` : ''}
          </span>
          <a
            href={url}
            download={shown.innerName}
            className="text-emerald-700 underline hover:text-emerald-900"
          >
            Scarica {shown.innerName} senza firma
          </a>
        </div>
      )}
      {shown && !shownKind && (
        <p className="text-sm text-slate-500">
          Il documento dentro la firma non si apre in anteprima: usa il link per scaricarlo.
        </p>
      )}
      {url && shownKind === 'image' && (
        <img
          src={url}
          alt={doc.file_name}
          className="mx-auto max-h-[70vh] max-w-full object-contain"
        />
      )}
      {url && shownKind === 'pdf' && (
        <iframe
          title={doc.file_name}
          src={url}
          className="paper h-[70vh] w-full rounded-lg border border-slate-200"
        />
      )}
      {url && shownKind === 'html' && (
        <iframe
          title={doc.file_name}
          src={url}
          sandbox=""
          className="paper h-[70vh] w-full rounded-lg border border-slate-200"
        />
      )}
      {url && shownKind === 'text' && shown?.textInFrame && (
        <iframe
          title={doc.file_name}
          src={url}
          sandbox=""
          className="paper h-[70vh] w-full rounded-lg border border-slate-200"
        />
      )}
      {url && shownKind === 'text' && !shown?.textInFrame && (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {shown?.text}
        </pre>
      )}
    </Modal>
  )
}
