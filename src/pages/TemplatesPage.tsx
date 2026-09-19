import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentTemplate } from '../types/db'
import { deleteTemplate, listTemplates } from '../services/templates'
import { categoryLabels } from '../data/documentCategories'
import { fmtDate } from '../lib/format'
import { DangerButton, PrimaryButton } from '../components/Buttons'
import { tableClass, tdClass, thClass, theadRowClass, trClass } from '../lib/tableStyles'

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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className={tableClass}>
            <thead>
              <tr className={theadRowClass}>
                <th className={thClass}>Nome</th>
                <th className={thClass}>Richiede</th>
                <th className={thClass}>Categoria</th>
                <th className={thClass}>Aggiornato</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className={trClass}>
                  <td className={tdClass}>
                    <Link to={`/template/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                      {t.name}
                    </Link>
                    {t.description && (
                      <p className="text-xs text-slate-400">{t.description}</p>
                    )}
                  </td>
                  <td className={tdClass}>
                    {[
                      t.requires_course ? 'Corso' : null,
                      t.person_role !== 'none' ? personRoleLabel[t.person_role] : null,
                    ]
                      .filter(Boolean)
                      .join(' + ') || '—'}
                  </td>
                  <td className={tdClass}>{categoryLabels[t.default_category]}</td>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    {fmtDate(t.updated_at)}
                  </td>
                  <td className={`${tdClass} text-right`}>
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
