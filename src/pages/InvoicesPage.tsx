import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Customer, CustomerInput, Invoice, InvoiceDirection } from '../types/db'
import {
  applyParsedXml,
  createCustomer,
  deleteCustomer,
  listCustomers,
  listInvoices,
  updateCustomer,
} from '../services/invoices'
import { fetchArubaInvoiceXml, syncArubaInvoices } from '../services/arubaInvoice'
import { customerDisplayName, docTypeLabel } from '../lib/fatturaPa'
import { formatEuro } from '../lib/euroInWords'
import { fmtDate } from '../lib/format'
import { matchesSearch } from '../lib/matchesSearch'
import { KpiCards } from '../components/KpiCards'
import { SegmentedControl } from '../components/SegmentedControl'
import { PrimaryButton, SecondaryButton, DangerButton } from '../components/Buttons'
import { Modal } from '../components/Modal'
import { CustomerForm } from '../components/CustomerForm'
import { InvoiceStatusPill } from '../components/InvoiceStatusPill'
import {
  tableWideClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadRowClass,
  trClass,
} from '../lib/tableStyles'

type Tab = 'out' | 'in' | 'customers'

const tabs: { value: Tab; label: string }[] = [
  { value: 'out', label: 'Emesse' },
  { value: 'in', label: 'Ricevute' },
  { value: 'customers', label: 'Clienti' },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function euro(value: number | null): string {
  return value == null ? '—' : `€ ${formatEuro(value)}`
}

export function InvoicesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (['out', 'in', 'customers'].includes(params.get('tab') ?? '') ? params.get('tab') : 'out') as Tab
  const currentYear = new Date().getFullYear()
  const year = Number(params.get('anno')) || currentYear
  const [search, setSearch] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<Customer | 'new' | null>(null)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  async function reload() {
    setLoading(true)
    try {
      if (tab === 'customers') setCustomers(await listCustomers())
      else setInvoices(await listInvoices(tab as InvoiceDirection, year))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSearch('')
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, year])

  /** Importa l'elenco da Aruba, poi scarica gli XML mancanti per totali e righe. */
  async function handleSync() {
    if (tab === 'customers') return
    const direction = tab as InvoiceDirection
    setSyncing(true)
    setSyncMessage('Lettura elenco da Aruba…')
    try {
      let added = 0
      let updated = 0
      for (let page = 1; page <= 50; page++) {
        const res = await syncArubaInvoices(direction, year, page)
        added += res.added
        updated += res.updated
        setSyncMessage(`Elenco Aruba: ${added} nuove, ${updated} aggiornate…`)
        if (res.last) break
      }
      let rows = await listInvoices(direction, year)
      setInvoices(rows)
      const missing = rows.filter((r) => r.aruba_filename && r.total == null)
      let done = 0
      for (const row of missing) {
        setSyncMessage(
          `${added} nuove, ${updated} aggiornate. Lettura importi: ${done}/${missing.length}…`,
        )
        try {
          const xml = await fetchArubaInvoiceXml(row.id)
          await applyParsedXml(row, xml)
        } catch (err) {
          const message = err instanceof Error ? err.message : ''
          if (/troppe richieste/i.test(message)) {
            setSyncMessage(`Aruba chiede una pausa: riprendo tra un minuto (${done}/${missing.length})…`)
            await sleep(61_000)
            continue
          }
        }
        done++
        await sleep(1500)
      }
      rows = await listInvoices(direction, year)
      setInvoices(rows)
      setSyncMessage(
        `Aggiornamento completato: ${added} nuove, ${updated} aggiornate${
          missing.length ? `, importi letti per ${done} fatture` : ''
        }.`,
      )
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Aggiornamento da Aruba non riuscito')
    } finally {
      setSyncing(false)
    }
  }

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((i) =>
        matchesSearch(
          [i.number, i.counterpart_name, i.counterpart_vat, i.counterpart_tax_code, i.causale, i.sdi_status_label].join(' '),
          search,
        ),
      ),
    [invoices, search],
  )

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) =>
        matchesSearch([customerDisplayName(c), c.vat_number, c.tax_code, c.email, c.city].join(' '), search),
      ),
    [customers, search],
  )

  const kpis = useMemo(() => {
    const valid = filteredInvoices.filter((i) => i.status !== 'draft')
    const sum = (key: 'taxable' | 'vat_amount' | 'total') =>
      valid.reduce((s, i) => s + (i[key] ?? 0) * (i.doc_type === 'TD04' ? -1 : 1), 0)
    const drafts = filteredInvoices.filter((i) => i.status === 'draft').length
    const unread = valid.filter((i) => i.total == null).length
    return [
      { key: 'count', label: tab === 'out' ? 'Fatture emesse' : 'Fatture ricevute', value: valid.length, hint: `Anno ${year}` },
      { key: 'taxable', label: 'Imponibile', value: `€ ${formatEuro(sum('taxable'))}`, hint: 'Note di credito sottratte' },
      { key: 'vat', label: 'IVA', value: `€ ${formatEuro(sum('vat_amount'))}` },
      { key: 'total', label: 'Totale documenti', value: `€ ${formatEuro(sum('total'))}`, hint: unread ? `${unread} senza importi: premi Aggiorna` : undefined },
      ...(tab === 'out' ? [{ key: 'drafts', label: 'Bozze', value: drafts, tone: drafts ? ('warn' as const) : ('default' as const) }] : []),
    ]
  }, [filteredInvoices, tab, year])

  async function saveCustomer(input: CustomerInput) {
    if (editingCustomer && editingCustomer !== 'new') await updateCustomer(editingCustomer.id, input)
    else await createCustomer(input)
    setEditingCustomer(null)
    setCustomers(await listCustomers())
  }

  async function removeCustomer(c: Customer) {
    if (!window.confirm(`Eliminare il cliente ${customerDisplayName(c)}? Le fatture già fatte restano.`)) return
    await deleteCustomer(c.id)
    setCustomers(await listCustomers())
  }

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Fatturazione</h1>
        <div className="flex flex-wrap gap-2">
          {tab === 'out' && (
            <PrimaryButton onClick={() => navigate('/fatturazione/nuova')}>+ Nuova fattura</PrimaryButton>
          )}
          {tab === 'customers' && (
            <PrimaryButton onClick={() => setEditingCustomer('new')}>+ Nuovo cliente</PrimaryButton>
          )}
          {tab !== 'customers' && (
            <SecondaryButton disabled={syncing} onClick={() => void handleSync()}>
              {syncing ? 'Aggiornamento…' : 'Aggiorna da Aruba'}
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SegmentedControl
          ariaLabel="Sezione fatturazione"
          value={tab}
          options={tabs}
          onChange={(v) => setParam('tab', v)}
        />
        {tab !== 'customers' && (
          <select
            aria-label="Anno"
            value={year}
            onChange={(e) => setParam('anno', e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'customers' ? 'Cerca cliente, P.IVA, CF…' : 'Cerca numero, cliente/fornitore, P.IVA…'}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm sm:max-w-sm"
        />
      </div>

      {syncMessage && <p className="text-sm text-slate-600">{syncMessage}</p>}

      {tab !== 'customers' && <KpiCards items={kpis} />}

      {loading ? (
        <p className="text-slate-400">Caricamento…</p>
      ) : tab === 'customers' ? (
        <div className={tableWrapClass}>
          <table className={tableWideClass}>
            <thead>
              <tr className={theadRowClass}>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>P.IVA / CF</th>
                <th className={thClass}>Città</th>
                <th className={thClass}>SDI / PEC</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => (
                <tr key={c.id} className={trClass}>
                  <td className={tdClass}>
                    <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setEditingCustomer(c)}>
                      {customerDisplayName(c)}
                    </button>
                  </td>
                  <td className={tdClass}>{[c.vat_number, c.tax_code].filter(Boolean).join(' · ') || '—'}</td>
                  <td className={tdClass}>{[c.city, c.province].filter(Boolean).join(' ') || '—'}</td>
                  <td className={tdClass}>{c.pec || c.sdi_code}</td>
                  <td className={tdClass + ' text-right'}>
                    <DangerButton onClick={() => void removeCustomer(c)}>Elimina</DangerButton>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={5}>
                    Nessun cliente. Aggiungili qui o direttamente dalla nuova fattura.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={tableWrapClass}>
          <table className={tableWideClass}>
            <thead>
              <tr className={theadRowClass}>
                <th className={thClass}>Numero</th>
                <th className={thClass}>Data</th>
                <th className={thClass}>{tab === 'out' ? 'Cliente' : 'Fornitore'}</th>
                <th className={thClass}>Tipo</th>
                <th className={thClass + ' text-right'}>Imponibile</th>
                <th className={thClass + ' text-right'}>Totale</th>
                <th className={thClass}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((i) => (
                <tr key={i.id} className={trClass}>
                  <td className={tdClass}>
                    <Link to={`/fatturazione/${i.id}`} className="font-medium text-indigo-600 hover:underline">
                      {i.number || '(bozza)'}
                    </Link>
                  </td>
                  <td className={tdClass}>{fmtDate(i.invoice_date)}</td>
                  <td className={tdClass}>
                    {i.counterpart_name || '—'}
                    {i.counterpart_vat || i.counterpart_tax_code ? (
                      <span className="block text-xs text-slate-400">{i.counterpart_vat || i.counterpart_tax_code}</span>
                    ) : null}
                  </td>
                  <td className={tdClass}>{docTypeLabel(i.doc_type)}</td>
                  <td className={tdClass + ' text-right'}>{euro(i.taxable)}</td>
                  <td className={tdClass + ' text-right font-medium'}>{euro(i.total)}</td>
                  <td className={tdClass}>
                    <InvoiceStatusPill invoice={i} />
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={7}>
                    Nessuna fattura per il {year}. Premi «Aggiorna da Aruba» per importarle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingCustomer && (
        <Modal
          title={editingCustomer === 'new' ? 'Nuovo cliente' : customerDisplayName(editingCustomer)}
          onClose={() => setEditingCustomer(null)}
        >
          <div className="overflow-y-auto">
            <CustomerForm
              initial={editingCustomer === 'new' ? undefined : editingCustomer}
              onSave={saveCustomer}
              onCancel={() => setEditingCustomer(null)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
