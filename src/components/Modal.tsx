import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Finestra larga, per leggere un PDF o un'immagine. */
  wide?: boolean
}

export function Modal({ title, onClose, children, wide = false }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={
          'relative z-10 flex max-h-[90vh] w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xl ' +
          (wide ? 'max-w-5xl' : 'max-w-lg')
        }
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="modal-title" className="min-w-0 break-words text-lg font-semibold text-slate-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Chiudi
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
