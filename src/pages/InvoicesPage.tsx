import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Customer, CustomerInput, Invoice, InvoiceDirection } from '../types/db'
import {
  createCustomer,
  deleteCustomer,
  listCustomerRoles,
  listCustomers,
  listInvoices,
  updateCustomer,
} from '../services/invoices'
import { importInvoiceFiles, linkPartiesFromInvoices } from '../services/invoiceImport'
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
import { ArubaSyncPanel } from '../components/ArubaSyncPanel'
import {
  tableWideClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadRowClass,
  trClass,
} from '../lib/tableStyles'

type Tab = 'out' | 'in' | 'customers' | 'suppliers'

const tabs: { value: Tab; label: string }[] = [
  { value: 'out', label: 'Emesse' },
  { value: 'in', label: 'Ricevute' },
  { value: 'customers', label: 'Clienti' },
  { value: 'suppliers', label: 'Fornitori' },
]

function euro(value: number | null): string {
  return value == null ? '—' : `€ ${formatEuro(value)}`
}

export function InvoicesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (tabs.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'out') as Tab
  /** Schede delle anagrafiche (clienti o fornitori) invece delle fatture. */
  const partyTab = tab === 'customers' || tab === 'suppliers'
  const currentYear = new Date().getFullYear()
  const year = Number(params.get('anno')) || currentYear
  const [search, setSearch] = useState('')
  /** Filtro per tipo documento: fatture, note di debito, note di credito. */
  const [docType, setDocType] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [roles, setRoles] = useState<Map<string, { out: boolean; in: boolean }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [importReport, setImportReport] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | 'new' | null>(null)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  async function reload() {
    setLoading(true)
    try {
      if (partyTab) {
        const [list, r] = await Promise.all([listCustomers(), listCustomerRoles()])
        setCustomers(list)
        setRoles(r)
      } else setInvoices(await listInvoices(tab as InvoiceDirection, year))
    } finally {
      setLoading(false)
    }
  }

  // Ricarica dopo una sincronizzazione finita sul PC (callback stabile per il pannello)
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const handleSynced = useCallback(() => void reloadRef.current(), [])

  useEffect(() => {
    setSearch('')
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, year])

  /** Importa le fatture scaricate dal pannello Aruba (XML, P7M o ZIP), emesse e ricevute insieme. */
  async function handleImport() {
    const files = Array.from(fileRef.current?.files ?? [])
    if (files.length === 0) return
    setImporting(true)
    setImportReport([])
    setImportMessage('Lettura dei file…')
    try {
      const res = await importInvoiceFiles(files, (done, total) =>
        setImportMessage(`Importazione fatture: ${done}/${total}…`),
      )
      setImportMessage(
        `Importazione completata: ${res.added} nuove, ${res.updated} già presenti aggiornate` +
          (res.partiesCreated ? `, ${res.partiesCreated} clienti/fornitori creati` : '') +
          (res.eipassCreated ? `, ${res.eipassCreated} corsisti EIPASS creati` : '') +
          (res.eipassLinked ? `, ${res.eipassLinked} abbinate a corsisti EIPASS` : '') +
          (res.coursesLinked ? `, ${res.coursesLinked} collegate ai corsi` : '') +
          '.',
      )
      setImportReport(res.report)
      await reload()
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Importazione non riuscita')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
      setImporting(false)
    }
  }

  const filteredInvoices = useMemo(
    () =>
      invoices
        .filter((i) => !docType || i.doc_type === docType)
        .filter((i) =>
          matchesSearch(
            [
              i.number,
              i.counterpart_name,
              i.counterpart_vat,
              i.counterpart_tax_code,
              i.causale,
              i.sdi_status_label,
              // Le righe riportano corso, ID CORSO e CUP delle note di debito
              ...i.lines.map((l) => l.description),
            ].join(' '),
            search,
          ),
        ),
    [invoices, search, docType],
  )

  /** Crea clienti e fornitori dai dati delle fatture già importate che non li hanno. */
  async function handleLinkParties() {
    setImporting(true)
    setImportReport([])
    setImportMessage('Lettura delle fatture…')
    try {
      const res = await linkPartiesFromInvoices((done, total) =>
        setImportMessage(`Anagrafiche dalle fatture: ${done}/${total}…`),
      )
      setImportMessage(
        `Fatto: ${res.partiesCreated} clienti/fornitori creati, ${res.linked} fatture collegate alla loro anagrafica` +
          (res.eipassCreated ? `, ${res.eipassCreated} corsisti EIPASS creati` : '') +
          (res.eipassLinked ? `, ${res.eipassLinked} fatture collegate a corsisti EIPASS` : '') +
          (res.coursesLinked ? `, ${res.coursesLinked} fatture collegate ai corsi` : '') +
          '.',
      )
      setImportReport(res.report)
      await reload()
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Operazione non riuscita')
    } finally {
      setImporting(false)
    }
  }

  const filteredCustomers = useMemo(
    () =>
      customers
        .filter((c) => {
          // Fornitore = compare nelle ricevute; cliente = nelle emesse, oppure senza fatture
          const role = roles.get(c.id)
          return tab === 'suppliers' ? !!role?.in : !role || role.out || !role.in
        })
        .filter((c) =>
          matchesSearch([customerDisplayName(c), c.vat_number, c.tax_code, c.email, c.city].join(' '), search),
        ),
    [customers, roles, tab, search],
  )

  const kpis = useMemo(() => {
    const valid = filteredInvoices.filter((i) => i.status !== 'draft')
    const sum = (key: 'taxable' | 'vat_amount' | 'total') =>
      valid.reduce((s, i) => s + (i[key] ?? 0) * (i.doc_type === 'TD04' ? -1 : 1), 0)
    const drafts = filteredInvoices.filter((i) => i.status === 'draft').length
    const unread = valid.filter((i) => i.total == null).length
    const paid = valid
      .filter((i) => i.paid_at)
      .reduce((s, i) => s + (i.total ?? 0) * (i.doc_type === 'TD04' ? -1 : 1), 0)
    return [
      { key: 'count', label: tab === 'out' ? 'Fatture emesse' : 'Fatture ricevute', value: valid.length, hint: `Anno ${year}` },
      { key: 'taxable', label: 'Imponibile', value: `€ ${formatEuro(sum('taxable'))}`, hint: 'Note di credito sottratte' },
      { key: 'vat', label: 'IVA', value: `€ ${formatEuro(sum('vat_amount'))}` },
      { key: 'total', label: 'Totale documenti', value: `€ ${formatEuro(sum('total'))}`, hint: unread ? `${unread} senza importi` : undefined },
      ...(tab === 'out'
        ? [{ key: 'paid', label: 'Incassato', value: `€ ${formatEuro(paid)}`, hint: 'Incassi segnati su Aruba' }]
        : []),
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
          {partyTab && (
            <>
              <SecondaryButton disabled={importing} onClick={() => void handleLinkParties()}>
                {importing ? 'Creazione…' : 'Crea dalle fatture'}
              </SecondaryButton>
              <PrimaryButton onClick={() => setEditingCustomer('new')}>
                {tab === 'suppliers' ? '+ Nuovo fornitore' : '+ Nuovo cliente'}
              </PrimaryButton>
            </>
          )}
          {!partyTab && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,.p7m,.zip"
                multiple
                className="hidden"
                onChange={() => void handleImport()}
              />
              <SecondaryButton disabled={importing} onClick={() => fileRef.current?.click()}>
                {importing ? 'Importazione…' : 'Importa da Aruba'}
              </SecondaryButton>
            </>
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
        {!partyTab && (
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
        {!partyTab && (
          <select
            aria-label="Tipo documento"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm"
          >
            <option value="">Tutti i tipi</option>
            <option value="TD01">Fatture</option>
            <option value="TD05">Note di debito</option>
            <option value="TD04">Note di credito</option>
          </select>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={partyTab ? `Cerca ${tab === 'suppliers' ? 'fornitore' : 'cliente'}, P.IVA, CF…` : 'Cerca numero, cliente, P.IVA, corso, CUP…'}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm sm:max-w-sm"
        />
      </div>

      {partyTab && (
        <p className="text-xs text-slate-500">
          Le anagrafiche si creano da sole quando importi le fatture. «Crea dalle fatture» le crea per quelle già
          importate.
        </p>
      )}
      {!partyTab && (
        <p className="text-xs text-slate-500">
          «Sincronizza con Aruba» scarica da solo le fatture nuove, gli stati SdI e gli incassi (lo esegue il PC). In
          alternativa scarica le fatture da Aruba e caricale con «Importa da Aruba»: le già presenti non si duplicano.
        </p>
      )}
      {importMessage && <p className="text-sm text-slate-600">{importMessage}</p>}
      {importReport.length > 0 && (
        <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-slate-600">
          {importReport.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      {!partyTab && (
        <ArubaSyncPanel years={[...new Set([year, currentYear])].sort()} onSynced={handleSynced} />
      )}

      {!partyTab && <KpiCards items={kpis} />}

      {loading ? (
        <p className="text-slate-400">Caricamento…</p>
      ) : partyTab ? (
        <div className={tableWrapClass}>
          <table className={tableWideClass}>
            <thead>
              <tr className={theadRowClass}>
                <th className={thClass}>{tab === 'suppliers' ? 'Fornitore' : 'Cliente'}</th>
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
                    {tab === 'suppliers'
                      ? 'Nessun fornitore. Si creano importando le fatture ricevute.'
                      : 'Nessun cliente. Aggiungili qui, dalla nuova fattura o importando le emesse.'}
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
                    {i.paid_at && <span className="block text-xs text-emerald-700">Incassata {fmtDate(i.paid_at)}</span>}
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={7}>
                    Nessuna fattura per il {year}. Premi «Importa da Aruba» e carica i file scaricati da Aruba.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingCustomer && (
        <Modal
          title={editingCustomer === 'new' ? (tab === 'suppliers' ? 'Nuovo fornitore' : 'Nuovo cliente') : customerDisplayName(editingCustomer)}
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
