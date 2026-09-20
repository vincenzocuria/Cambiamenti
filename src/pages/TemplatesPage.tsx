import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentCategory, DocumentTemplate } from '../types/db'
import { deleteTemplate, listTemplates } from '../services/templates'
import { categoryLabels } from '../data/documentCategories'
import { fmtDate } from '../lib/format'
import { matchesSearch } from '../lib/matchesSearch'
import { describeFilters, exportFilteredList } from '../lib/listExport'
import { useListQuery } from '../hooks/useListQuery'
import { DangerButton, PrimaryButton } from '../components/Buttons'
import { usePagedSlice } from '../hooks/usePagedSlice'
import { KpiCards } from '../components/KpiCards'
import { ListToolbar } from '../components/ListToolbar'
import { ListPagination } from '../components/ListPagination'
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

function requiresLabel(t: DocumentTemplate): string {
  return (
    [t.requires_course ? 'Corso' : null, t.person_role !== 'none' ? personRoleLabel[t.person_role] : null]
      .filter(Boolean)
      .join(' + ') || '—'
  )
}

function matchesTemplateStatus(t: DocumentTemplate, status: string): boolean {
  if (!status) return true
  if (status === 'con_corso') return t.requires_course
  if (status === 'con_persona') return t.person_role !== 'none'
  if (status in categoryLabels) return t.default_category === status
  return true
}

export function TemplatesPage() {
  const [items, setItems] = useState<DocumentTemplate[]>([])
  const [error, setError] = useState('')
  const { search, status, setSearch, setStatus } = useListQuery()

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

  const searched = useMemo(
    () =>
      items.filter((t) =>
        matchesSearch(
          `${t.name} ${t.description} ${categoryLabels[t.default_category]} ${requiresLabel(t)}`,
          search,
        ),
      ),
    [items, search],
  )

  const filtered = useMemo(
    () => searched.filter((t) => matchesTemplateStatus(t, status)),
    [searched, status],
  )

  const { page, setPage, pages, slice, pageSize } = usePagedSlice(
    filtered,
    `${search}|${status}`,
  )
  const { withCourse, withPerson } = useMemo(() => {
    let withCourse = 0
    let withPerson = 0
    for (const t of items) {
      if (t.requires_course) withCourse += 1
      if (t.person_role !== 'none') withPerson += 1
    }
    return { withCourse, withPerson }
  }, [items])
  const statusLabel =
    status === 'con_corso'
      ? 'Richiede corso'
      : status === 'con_persona'
        ? 'Richiede persona'
        : status
          ? categoryLabels[status as DocumentCategory]
          : ''

  function toggleStatus(key: string) {
    setStatus(status === key ? '' : key)
  }

  function exportList(format: 'excel' | 'pdf') {
    exportFilteredList({
      title: 'Template documenti',
      rows: filtered,
      format,
      filters: describeFilters([statusLabel, search && `ricerca «${search}»`]),
      columns: [
        { header: 'Nome', value: (t) => t.name },
        { header: 'Descrizione', value: (t) => t.description || '' },
        { header: 'Richiede', value: (t) => requiresLabel(t) },
        { header: 'Categoria', value: (t) => categoryLabels[t.default_category] },
        { header: 'Aggiornato', value: (t) => fmtDate(t.updated_at) },
      ],
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
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

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <KpiCards
        items={[
          {
            key: 'totale',
            label: 'Totale template',
            hint: 'In archivio',
            value: items.length,
            active: !status,
            onClick: () => setStatus(''),
          },
          {
            key: 'con_corso',
            label: 'Richiede corso',
            hint: 'Legati a un corso',
            value: withCourse,
            active: status === 'con_corso',
            onClick: () => toggleStatus('con_corso'),
          },
          {
            key: 'con_persona',
            label: 'Richiede persona',
            hint: 'Alunno o personale',
            value: withPerson,
            active: status === 'con_persona',
            onClick: () => toggleStatus('con_persona'),
          },
        ]}
      />

      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Cerca per nome, categoria o destinatario…"
        resultCount={filtered.length}
        totalCount={items.length}
        unitSingular="template"
        unitPlural="template"
        onExportExcel={() => exportList('excel')}
        onExportPdf={() => exportList('pdf')}
      />

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
              {slice.map((t) => (
                <tr key={t.id} className={trClass}>
                  <td className={tdClass}>
                    <Link to={`/template/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                      {t.name}
                    </Link>
                    {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                  </td>
                  <td className={tdClass}>{requiresLabel(t)}</td>
                  <td className={tdClass}>{categoryLabels[t.default_category]}</td>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    {fmtDate(t.updated_at)}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <DangerButton onClick={() => void handleDelete(t)}>Elimina</DangerButton>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${tdClass} py-10 text-center text-slate-400`}>
                    Nessun risultato per i filtri selezionati.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <ListPagination
        page={page}
        pages={pages}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
      />
    </div>
  )
}
