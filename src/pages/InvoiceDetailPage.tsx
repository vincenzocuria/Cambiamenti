import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Customer, CustomerInput, Invoice, InvoiceLine } from '../types/db'
import {
  createCustomer,
  createInvoice,
  deleteInvoice,
  getInvoice,
  listCustomers,
  updateInvoice,
} from '../services/invoices'
import {
  isPublicAdministration,
  suggestNextInvoiceNumber,
  suggestPaInvoiceNumber,
} from '../services/invoiceNumbering'
import { listInvoiceCourses, relinkInvoiceCourses } from '../services/courseInvoices'
import { courseInvoiceKindLabel } from '../lib/courseInvoice'
import {
  buildInvoiceXml,
  computeTotals,
  customerDisplayName,
  docTypeLabel,
  docTypes,
  draftMissingFields,
  lineTotal,
  vatNatures,
  type InvoiceDraft,
} from '../lib/fatturaPa'
import { invoiceFileName, paymentMethodLabel, paymentMethods, randomProgressive } from '../lib/eipassInvoice'
import { calendarDateIso } from '../lib/studentDocumentStatus'
import { downloadBlob } from '../lib/downloadBlob'
import { formatEuro } from '../lib/euroInWords'
import { fmtDate, formatCourseEdition } from '../lib/format'
import { fieldInputClass, SelectField, TextField, TextAreaField } from '../components/Field'
import { DangerButton, PrimaryButton, SecondaryButton } from '../components/Buttons'
import { Modal } from '../components/Modal'
import { CustomerForm } from '../components/CustomerForm'
import { InvoiceStatusPill } from '../components/InvoiceStatusPill'

const emptyLine: InvoiceLine = { description: '', quantity: 1, unit_price: 0, vat_rate: 22, nature: '' }

function euro(value: number | null | undefined): string {
  return value == null ? '—' : `€ ${formatEuro(value)}`
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  )
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'nuova'
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    listCustomers().then(setCustomers).catch(() => setCustomers([]))
    if (isNew) {
      const from = params.get('da')
      if (from) {
        // Duplica (o nota di credito) partendo da una fattura esistente
        getInvoice(from)
          .then((src) =>
            setInvoice({
              ...src,
              id: '',
              status: 'draft',
              doc_type: params.get('tipo') || src.doc_type,
              number: '',
              invoice_date: calendarDateIso(),
              aruba_filename: null,
              sdi_id: '',
              sdi_status: '',
              sdi_status_label: '',
              paid_at: null,
              xml: null,
              causale:
                params.get('tipo') === 'TD04'
                  ? `Nota di credito a storno della fattura n. ${src.number} del ${fmtDate(src.invoice_date)}`
                  : src.causale,
            }),
          )
          .catch((err) => setError(err instanceof Error ? err.message : 'Fattura non trovata'))
      } else {
        setInvoice(null)
      }
      return
    }
    getInvoice(id!)
      .then(setInvoice)
      .catch((err) => setError(err instanceof Error ? err.message : 'Fattura non trovata'))
  }, [id, isNew, params])

  if (error) return <p className="text-red-600">{error}</p>
  if (!isNew && !invoice) return <p className="text-slate-400">Caricamento…</p>

  const editable = isNew || invoice?.status === 'draft'

  return (
    <div className="space-y-5">
      <Link to="/fatturazione" className="text-sm text-indigo-600 hover:underline">
        ← Fatturazione
      </Link>
      {editable ? (
        <InvoiceEditor
          key={invoice?.id || 'new'}
          initial={invoice}
          customers={customers}
          onCustomersChanged={setCustomers}
          onSaved={(saved) => {
            setInvoice(saved)
            if (isNew) navigate(`/fatturazione/${saved.id}`, { replace: true })
          }}
          onDeleted={() => navigate('/fatturazione')}
        />
      ) : (
        <InvoiceView invoice={invoice!} onChange={setInvoice} />
      )}
    </div>
  )
}

/** Fattura importata da Aruba o già caricata su Aruba: sola lettura. */
function InvoiceView({ invoice, onChange }: { invoice: Invoice; onChange: (i: Invoice) => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [courses, setCourses] = useState<Awaited<ReturnType<typeof listInvoiceCourses>>>([])

  useEffect(() => {
    listInvoiceCourses(invoice.id)
      .then(setCourses)
      .catch(() => setCourses([]))
  }, [invoice.id])

  async function handleDownload() {
    setBusy(true)
    setMessage('')
    try {
      const xml = invoice.xml
      if (!xml) {
        setMessage('XML non disponibile per questa fattura')
        return
      }
      downloadBlob(
        new Blob([xml], { type: 'application/xml' }),
        invoice.aruba_filename?.replace(/\.p7m$/i, '') || `fattura-${invoice.number}.xml`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Download non riuscito')
    } finally {
      setBusy(false)
    }
  }

  /** Una fattura segnata per errore come caricata torna bozza modificabile. */
  async function handleReopen() {
    if (!window.confirm('Riportare la fattura in bozza? Fallo solo se non l’hai caricata su Aruba.')) return
    setBusy(true)
    setMessage('')
    try {
      onChange(await updateInvoice(invoice.id, { status: 'draft' }))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  const out = invoice.direction === 'out'

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {docTypeLabel(invoice.doc_type)} n. {invoice.number || '—'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {fmtDate(invoice.invoice_date)} · {out ? 'emessa' : 'ricevuta'} · <InvoiceStatusPill invoice={invoice} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton disabled={busy} onClick={() => void handleDownload()}>
            Scarica XML
          </SecondaryButton>
          {out && invoice.status === 'sent' && !invoice.aruba_filename && (
            <SecondaryButton disabled={busy} onClick={() => void handleReopen()}>
              Riporta in bozza
            </SecondaryButton>
          )}
          {out && (
            <>
              <Link to={`/fatturazione/nuova?da=${invoice.id}`}>
                <SecondaryButton>Duplica</SecondaryButton>
              </Link>
              {invoice.doc_type !== 'TD04' && (
                <Link to={`/fatturazione/nuova?da=${invoice.id}&tipo=TD04`}>
                  <SecondaryButton>Nota di credito</SecondaryButton>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={out ? 'Cliente' : 'Fornitore'}>
          <p className="font-medium text-slate-800">{invoice.counterpart_name || '—'}</p>
          {invoice.counterpart_vat && <p className="text-sm text-slate-600">P.IVA {invoice.counterpart_vat}</p>}
          {invoice.counterpart_tax_code && <p className="text-sm text-slate-600">CF {invoice.counterpart_tax_code}</p>}
        </Card>
        <Card title="Importi">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-500">Imponibile</dt>
            <dd className="text-right">{euro(invoice.taxable)}</dd>
            <dt className="text-slate-500">IVA</dt>
            <dd className="text-right">{euro(invoice.vat_amount)}</dd>
            {invoice.stamp ? (
              <>
                <dt className="text-slate-500">Bollo</dt>
                <dd className="text-right">{euro(invoice.stamp)}</dd>
              </>
            ) : null}
            <dt className="font-medium text-slate-700">Totale</dt>
            <dd className="text-right font-semibold">{euro(invoice.total)}</dd>
          </dl>
        </Card>
        <Card title="Trasmissione">
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline text-slate-500">Stato: </dt>
              <dd className="inline">
                {invoice.status === 'sent' && !invoice.aruba_filename
                  ? 'Caricata su Aruba. Importa da Aruba il file inviato per chiudere il giro.'
                  : invoice.sdi_status_label || invoice.sdi_status || (invoice.aruba_filename ? 'File di Aruba importato' : '—')}
              </dd>
            </div>
            {invoice.sdi_id && (
              <div>
                <dt className="inline text-slate-500">ID SdI: </dt>
                <dd className="inline">{invoice.sdi_id}</dd>
              </div>
            )}
            {invoice.aruba_filename && (
              <div className="break-all">
                <dt className="inline text-slate-500">File: </dt>
                <dd className="inline">{invoice.aruba_filename}</dd>
              </div>
            )}
            {invoice.paid_at && (
              <div>
                <dt className="inline text-slate-500">Incassata il: </dt>
                <dd className="inline text-emerald-700">{fmtDate(invoice.paid_at)}</dd>
              </div>
            )}
            {invoice.payment_due && (
              <div>
                <dt className="inline text-slate-500">Scadenza: </dt>
                <dd className="inline">{fmtDate(invoice.payment_due)}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {courses.length > 0 && (
        <Card title="Corsi">
          <ul className="space-y-1 text-sm">
            {courses.map((c) => (
              <li key={c.line_index} className="flex flex-wrap justify-between gap-2">
                <Link to={`/corsi/${c.course.id}`} className="font-medium text-indigo-600 hover:underline">
                  {c.course.name}
                  {formatCourseEdition(c.course.edition) ? ` · ${formatCourseEdition(c.course.edition)}` : ''}
                </Link>
                <span className="text-slate-600">
                  {courseInvoiceKindLabel(c.kind)} · {euro(c.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {invoice.causale && (
        <Card title="Causale">
          <p className="text-sm text-slate-700">{invoice.causale}</p>
        </Card>
      )}

      {invoice.lines.length > 0 && (
        <Card title="Righe">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-2">Descrizione</th>
                <th className="py-2 text-right">Q.tà</th>
                <th className="py-2 text-right">Prezzo</th>
                <th className="py-2 text-right">IVA</th>
                <th className="py-2 text-right">Totale</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-3">{l.description}</td>
                  <td className="py-2 text-right">{l.quantity}</td>
                  <td className="py-2 text-right">{euro(l.unit_price)}</td>
                  <td className="py-2 text-right">{l.vat_rate ? `${l.vat_rate}%` : l.nature || '0%'}</td>
                  <td className="py-2 text-right">{euro(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}

interface EditorProps {
  initial: Invoice | null
  customers: Customer[]
  onCustomersChanged: (c: Customer[]) => void
  onSaved: (i: Invoice) => void
  onDeleted: () => void
}

/** Fattura manuale (bozza): cliente, righe, IVA; poi XML da caricare su Aruba. */
function InvoiceEditor({ initial, customers, onCustomersChanged, onSaved, onDeleted }: EditorProps) {
  const [invoiceId, setInvoiceId] = useState(initial?.id || '')
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? '')
  const [draft, setDraft] = useState<InvoiceDraft>(() => ({
    doc_type: initial?.doc_type || 'TD01',
    number: initial?.number ?? '',
    invoice_date: initial?.invoice_date ?? calendarDateIso(),
    causale: initial?.causale ?? '',
    payment_method: initial?.payment_method || 'bonifico',
    payment_due: initial?.payment_due ?? null,
    lines: initial?.lines?.length ? initial.lines : [{ ...emptyLine }],
    stamp: null,
  }))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  const customer = customers.find((c) => c.id === customerId) ?? null
  const totals = useMemo(() => computeTotals(draft.lines, draft.stamp), [draft.lines, draft.stamp])

  function set<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setLine(index: number, patch: Partial<InvoiceLine>) {
    setDraft((d) => ({ ...d, lines: d.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }))
  }

  async function proposeNumber() {
    setError('')
    const year = Number((draft.invoice_date ?? calendarDateIso()).slice(0, 4))
    if (isPublicAdministration(customer?.sdi_code)) {
      set('number', await suggestPaInvoiceNumber(year))
      setInfo('Cliente pubblica amministrazione: numero nella serie FPA, separata dalle fatture ai privati.')
      return
    }
    const { number, registered } = await suggestNextInvoiceNumber(year)
    set('number', number)
    setInfo(
      registered
        ? 'Numero calcolato sulle fatture nel registro: se hai emesso fatture su Aruba dopo l’ultima importazione, importale prima.'
        : 'Nessuna fattura emessa nel registro per quest’anno: importa prima da Aruba le fatture già emesse, poi ricalcola il numero.',
    )
  }

  function payload() {
    return {
      direction: 'out' as const,
      status: 'draft' as const,
      doc_type: draft.doc_type,
      number: draft.number.trim(),
      invoice_date: draft.invoice_date,
      customer_id: customerId || null,
      counterpart_name: customer ? customerDisplayName(customer) : '',
      counterpart_vat: customer?.vat_number ?? '',
      counterpart_tax_code: customer?.tax_code ?? '',
      taxable: totals.taxable,
      vat_amount: totals.vat,
      stamp: totals.stamp || null,
      total: totals.total,
      payment_method: draft.payment_method,
      payment_due: draft.payment_due,
      causale: draft.causale,
      lines: draft.lines,
      notes,
    }
  }

  async function save(): Promise<Invoice> {
    const saved = invoiceId ? await updateInvoice(invoiceId, payload()) : await createInvoice(payload())
    // Le righe con «ID CORSO …» restano collegate ai corsi anche dopo le modifiche
    await relinkInvoiceCourses(saved.id, saved.lines).catch(() => 0)
    setInvoiceId(saved.id)
    onSaved(saved)
    return saved
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  const missing = draftMissingFields(draft, customer)

  /** Salva la bozza e scarica l'XML da caricare nel pannello Aruba. */
  async function handleDownload() {
    if (missing.length) throw new Error(`Per l'XML mancano: ${missing.join(', ')}`)
    const progressive = randomProgressive()
    const xml = buildInvoiceXml(draft, customer!, progressive)
    const saved = await save()
    await updateInvoice(saved.id, { xml })
    downloadBlob(new Blob([xml], { type: 'application/xml' }), invoiceFileName(progressive))
    setInfo(
      'XML scaricato. Caricalo su Aruba (Fatture emesse → Carica fattura), poi premi «Segna come caricata su Aruba».',
    )
  }

  /** Dopo il caricamento su Aruba la fattura non è più modificabile. */
  async function handleMarkUploaded() {
    const ok = window.confirm(
      `Hai caricato su Aruba la ${docTypeLabel(draft.doc_type).toLowerCase()} n. ${draft.number} a ${customerDisplayName(customer!)} per € ${formatEuro(totals.total)}? Da ora non sarà più modificabile.`,
    )
    if (!ok) return
    const saved = await save()
    const current = await getInvoice(saved.id)
    const xml = current.xml || buildInvoiceXml(draft, customer!)
    onSaved(await updateInvoice(saved.id, { status: 'sent', xml }))
  }

  async function saveNewCustomer(input: CustomerInput) {
    const created = await createCustomer(input)
    onCustomersChanged(await listCustomers())
    setCustomerId(created.id)
    setCreatingCustomer(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          {invoiceId ? `Bozza ${docTypeLabel(draft.doc_type).toLowerCase()}` : `Nuova ${docTypeLabel(draft.doc_type).toLowerCase()}`}
        </h1>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton disabled={busy} onClick={() => void run(async () => { await save(); setInfo('Bozza salvata') })}>
            Salva bozza
          </SecondaryButton>
          <SecondaryButton
            disabled={busy || missing.length > 0}
            title={missing.length ? `Mancano: ${missing.join(', ')}` : undefined}
            onClick={() => void run(handleDownload)}
          >
            Scarica XML per Aruba
          </SecondaryButton>
          <PrimaryButton
            disabled={busy || missing.length > 0}
            title={missing.length ? `Mancano: ${missing.join(', ')}` : undefined}
            onClick={() => void run(handleMarkUploaded)}
          >
            Segna come caricata su Aruba
          </PrimaryButton>
          {invoiceId && (
            <DangerButton
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!window.confirm('Eliminare questa bozza?')) return
                  await deleteInvoice(invoiceId)
                  onDeleted()
                })
              }
            >
              Elimina bozza
            </DangerButton>
          )}
        </div>
      </div>
      {missing.length > 0 && (
        <p className="text-sm text-amber-700">Per preparare l'XML mancano: {missing.join(', ')}.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}

      <Card title="Cliente">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <SelectField label="Cliente" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— seleziona —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {customerDisplayName(c)} {c.vat_number || c.tax_code ? `(${c.vat_number || c.tax_code})` : ''}
                </option>
              ))}
            </SelectField>
          </div>
          <SecondaryButton type="button" onClick={() => setCreatingCustomer(true)}>
            + Nuovo cliente
          </SecondaryButton>
        </div>
        {customer && (
          <p className="mt-2 text-xs text-slate-500">
            {[customer.address, customer.postal_code, customer.city, customer.province].filter(Boolean).join(', ')} ·
            {customer.pec ? ` PEC ${customer.pec}` : ` SDI ${customer.sdi_code}`}
          </p>
        )}
      </Card>

      <Card title="Documento">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Tipo" value={draft.doc_type} onChange={(e) => set('doc_type', e.target.value)}>
            {docTypes.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label} ({d.code})
              </option>
            ))}
          </SelectField>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField label="Numero" value={draft.number} onChange={(e) => set('number', e.target.value)} />
            </div>
            <SecondaryButton type="button" disabled={busy} onClick={() => void run(proposeNumber)}>
              Successivo
            </SecondaryButton>
          </div>
          <TextField
            label="Data"
            type="date"
            value={draft.invoice_date ?? ''}
            onChange={(e) => set('invoice_date', e.target.value || null)}
          />
          <SelectField
            label="Pagamento"
            value={draft.payment_method}
            onChange={(e) => set('payment_method', e.target.value)}
          >
            {paymentMethods.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Scadenza pagamento"
            type="date"
            value={draft.payment_due ?? ''}
            onChange={(e) => set('payment_due', e.target.value || null)}
            hint="Se vuota, la data della fattura"
          />
          <SelectField
            label="Marca da bollo"
            value={draft.stamp == null ? 'auto' : draft.stamp ? 'si' : 'no'}
            onChange={(e) => set('stamp', e.target.value === 'auto' ? null : e.target.value === 'si')}
            hint="Automatica: 2 € se le righe senza IVA superano 77,47 €"
          >
            <option value="auto">Automatica</option>
            <option value="si">Sì</option>
            <option value="no">No</option>
          </SelectField>
        </div>
        <div className="mt-4">
          <TextAreaField label="Causale" value={draft.causale} onChange={(e) => set('causale', e.target.value)} />
        </div>
      </Card>

      <Card title="Righe">
        <div className="space-y-3">
          {draft.lines.map((line, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-12">
              <textarea
                aria-label="Descrizione"
                className={fieldInputClass + ' col-span-2 sm:col-span-5'}
                rows={2}
                placeholder="Descrizione"
                value={line.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
              />
              <label className="text-xs text-slate-500 sm:col-span-1">
                Q.tà
                <input
                  className={fieldInputClass}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(e) => setLine(i, { quantity: Number(e.target.value.replace(',', '.')) || 0 })}
                />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2">
                Prezzo € (IVA esclusa)
                <input
                  className={fieldInputClass}
                  inputMode="decimal"
                  value={line.unit_price}
                  onChange={(e) => setLine(i, { unit_price: Number(e.target.value.replace(',', '.')) || 0 })}
                />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2">
                IVA
                <select
                  className={fieldInputClass}
                  value={line.vat_rate ? String(line.vat_rate) : line.nature || 'N4'}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v.startsWith('N')) setLine(i, { vat_rate: 0, nature: v })
                    else setLine(i, { vat_rate: Number(v), nature: '' })
                  }}
                >
                  <option value="22">22%</option>
                  <option value="10">10%</option>
                  <option value="4">4%</option>
                  {vatNatures.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end justify-between gap-2 sm:col-span-2">
                <span className="pb-2 text-sm font-medium">{euro(lineTotal(line))}</span>
                {draft.lines.length > 1 && (
                  <button
                    type="button"
                    className="pb-2 text-xs text-red-600 hover:underline"
                    onClick={() => set('lines', draft.lines.filter((_, j) => j !== i))}
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            </div>
          ))}
          <SecondaryButton type="button" onClick={() => set('lines', [...draft.lines, { ...emptyLine }])}>
            + Aggiungi riga
          </SecondaryButton>
        </div>
        <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Imponibile</dt>
          <dd className="text-right">{euro(totals.taxable)}</dd>
          <dt className="text-slate-500">IVA</dt>
          <dd className="text-right">{euro(totals.vat)}</dd>
          {totals.stamp > 0 && (
            <>
              <dt className="text-slate-500">Bollo</dt>
              <dd className="text-right">{euro(totals.stamp)}</dd>
            </>
          )}
          <dt className="font-medium">Totale</dt>
          <dd className="text-right font-semibold">{euro(totals.total)}</dd>
        </dl>
      </Card>

      <TextAreaField label="Note interne (non vanno in fattura)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <p className="text-xs text-slate-400">Pagamento: {paymentMethodLabel(draft.payment_method)}</p>

      {creatingCustomer && (
        <Modal title="Nuovo cliente" onClose={() => setCreatingCustomer(false)}>
          <div className="overflow-y-auto">
            <CustomerForm onSave={saveNewCustomer} onCancel={() => setCreatingCustomer(false)} />
          </div>
        </Modal>
      )}
    </div>
  )
}
