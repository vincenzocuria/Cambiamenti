import { useState } from 'react'

/** Mostra/nasconde un valore sensibile (es. password FAD) in sola lettura. */
export function SecretValue({ value, empty = '—' }: { value: string; empty?: string }) {
  const [visible, setVisible] = useState(false)

  if (!value) {
    return <p className="text-sm font-medium text-slate-700">{empty}</p>
  }

  return (
    <div className="flex items-center gap-2">
      <p className="font-mono text-sm font-medium text-slate-700">
        {visible ? value : '••••••••'}
      </p>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-xs font-medium text-indigo-600 hover:underline"
      >
        {visible ? 'Nascondi' : 'Mostra'}
      </button>
    </div>
  )
}
