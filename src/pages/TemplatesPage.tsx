import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentTemplate } from '../types/db'
import { deleteTemplate, listTemplates } from '../services/templates'
import { categoryLabels } from '../data/documentCategories'
import { fmtDate } from '../lib/format'
import { DangerButton, PrimaryButton } from '../components/Buttons'

const personRoleLabel: Record<string, string> = {
  none: 'Solo corso / generico',
  student: 'Alunno',
  staff: 'Personale',
  teacher: 'Docente',
  tutor: 'Tutor',
  admin_staff: 'Figura amministrativa',
  any: 'Qualsiasi persona',
}

export function TemplatesPage() {
  const [items, setItems] = useState<DocumentTemplate[]>([])
  const [error, setError] = useState('')

  async function reload() {
    setItems(await listTemplates())
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Errore'))
  }, [])

  async function handleDelete(t: DocumentTemplate) {
    if (!window.confirm(`Eliminare il template "${t.name}"?`)) return
    await deleteTemplate(t.id)
    await reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Template documenti</h1>
          <p className="text-sm text-slate-500">
            Testi con segnaposto {'{{...}}'} da usare per generare moduli e lettere.
          </p>
        </div>
        <Link to="/template/nuovo">
          <PrimaryButton type="button">Nuovo template</PrimaryButton>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          Nessun template. Creane uno per iniziare (es. lettera d&apos;incarico).
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-3">Nome</th>
                <th>Richiede</th>
                <th>Categoria</th>
                <th>Aggiornato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <Link to={`/template/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                      {t.name}
                    </Link>
                    {t.description && (
                      <p className="text-xs text-slate-400">{t.description}</p>
                    )}
                  </td>
                  <td>
                    {[
                      t.requires_course ? 'Corso' : null,
                      t.person_role !== 'none' ? personRoleLabel[t.person_role] : null,
                    ]
                      .filter(Boolean)
                      .join(' + ') || '—'}
                  </td>
                  <td>{categoryLabels[t.default_category]}</td>
                  <td>{fmtDate(t.updated_at)}</td>
                  <td className="px-4 text-right">
                    <DangerButton onClick={() => void handleDelete(t)}>Elimina</DangerButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
