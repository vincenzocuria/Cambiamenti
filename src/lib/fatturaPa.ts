import { school } from '../data/school'
import type { Customer, InvoiceLine } from '../types/db'
import { money, paymentMethods, randomProgressive, round2, text } from './eipassInvoice'

/** Tipi documento più usati (FatturaPA). */
export const docTypes = [
  { code: 'TD01', label: 'Fattura' },
  { code: 'TD04', label: 'Nota di credito' },
  { code: 'TD05', label: 'Nota di debito' },
  { code: 'TD06', label: 'Parcella' },
] as const

export function docTypeLabel(code: string): string {
  return docTypes.find((d) => d.code === code)?.label ?? code
}

/** Natura dell'operazione per le righe senza IVA, con il riferimento normativo stampato in fattura. */
export const vatNatures = [
  { code: 'N4', label: 'Esente art. 10 (es. formazione)', law: 'Esente art. 10 DPR 633/72' },
  { code: 'N2.2', label: 'Non soggetta', law: 'Operazione non soggetta' },
  { code: 'N1', label: 'Esclusa art. 15', law: 'Escluso art. 15 DPR 633/72' },
] as const

/** Sopra questa soglia, senza IVA, serve la marca da bollo virtuale da 2 €. */
const BOLLO_THRESHOLD = 77.47
const BOLLO_AMOUNT = 2

export function lineTotal(line: InvoiceLine): number {
  return round2(line.quantity * line.unit_price)
}

export type InvoiceTotals = {
  taxable: number
  vat: number
  stamp: number
  total: number
  /** Riepiloghi per aliquota/natura, come nel blocco DatiRiepilogo. */
  summary: { vatRate: number; nature: string; taxable: number; vat: number }[]
}

export function computeTotals(lines: InvoiceLine[], withStamp: boolean | null = null): InvoiceTotals {
  const groups = new Map<string, { vatRate: number; nature: string; taxable: number; vat: number }>()
  for (const line of lines) {
    const nature = line.vat_rate === 0 ? line.nature || 'N4' : ''
    const key = `${line.vat_rate}|${nature}`
    const g = groups.get(key) ?? { vatRate: line.vat_rate, nature, taxable: 0, vat: 0 }
    g.taxable = round2(g.taxable + lineTotal(line))
    groups.set(key, g)
  }
  const summary = [...groups.values()].map((g) => ({ ...g, vat: round2((g.taxable * g.vatRate) / 100) }))
  const taxable = round2(summary.reduce((s, g) => s + g.taxable, 0))
  const vat = round2(summary.reduce((s, g) => s + g.vat, 0))
  const exemptTaxable = summary.filter((g) => g.vatRate === 0).reduce((s, g) => s + g.taxable, 0)
  const stampDue = withStamp ?? exemptTaxable > BOLLO_THRESHOLD
  const stamp = stampDue ? BOLLO_AMOUNT : 0
  return { taxable, vat, stamp, total: round2(taxable + vat + stamp), summary }
}

export function customerDisplayName(c: Pick<Customer, 'company_name' | 'first_name' | 'last_name'>): string {
  return c.company_name.trim() || `${c.last_name} ${c.first_name}`.trim()
}

export interface InvoiceDraft {
  doc_type: string
  number: string
  invoice_date: string | null
  causale: string
  payment_method: string
  payment_due: string | null
  lines: InvoiceLine[]
  stamp: boolean | null
}

/** Cosa manca per generare l'XML di una fattura. */
export function draftMissingFields(d: InvoiceDraft, c: Customer | null): string[] {
  const missing: string[] = []
  if (!c) missing.push('cliente')
  else {
    if (!c.company_name.trim() && (!c.first_name.trim() || !c.last_name.trim())) {
      missing.push('nome e cognome o ragione sociale del cliente')
    }
    if (!c.vat_number.trim() && !c.tax_code.trim()) missing.push('P.IVA o codice fiscale del cliente')
    if (!c.address.trim() || !c.city.trim() || !/^\d{5}$/.test(c.postal_code.trim())) {
      missing.push('indirizzo, CAP e città del cliente')
    }
  }
  if (!d.number.trim()) missing.push('numero')
  if (!d.invoice_date) missing.push('data')
  if (d.lines.length === 0) missing.push('almeno una riga')
  if (d.lines.some((l) => !l.description.trim())) missing.push('descrizione di ogni riga')
  return missing
}

function partyXml(c: Customer): string {
  const vat = c.vat_number.trim().toUpperCase().replace(/^IT/, '')
  const tax = c.tax_code.trim().toUpperCase()
  const country = (c.country.trim() || 'IT').toUpperCase()
  const name = c.company_name.trim()
    ? `<Denominazione>${text(c.company_name, 80)}</Denominazione>`
    : `<Nome>${text(c.first_name, 60)}</Nome>
          <Cognome>${text(c.last_name, 60)}</Cognome>`
  const province = c.province.trim().toUpperCase()
  return `<CessionarioCommittente>
      <DatiAnagrafici>${
        vat
          ? `
        <IdFiscaleIVA>
          <IdPaese>${country}</IdPaese>
          <IdCodice>${vat}</IdCodice>
        </IdFiscaleIVA>`
          : ''
      }${tax ? `\n        <CodiceFiscale>${tax}</CodiceFiscale>` : ''}
        <Anagrafica>
          ${name}
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${text(c.address, 60)}</Indirizzo>
        <CAP>${c.postal_code.trim()}</CAP>
        <Comune>${text(c.city, 60)}</Comune>${
          /^[A-Z]{2}$/.test(province) && country === 'IT' ? `\n        <Provincia>${province}</Provincia>` : ''
        }
        <Nazione>${country}</Nazione>
      </Sede>
    </CessionarioCommittente>`
}

/** Fattura elettronica FatturaPA (verso privati o aziende) a partire da cliente e righe. */
export function buildInvoiceXml(d: InvoiceDraft, c: Customer, progressive = randomProgressive()): string {
  const missing = draftMissingFields(d, c)
  if (missing.length) throw new Error(`Per generare la fattura mancano: ${missing.join(', ')}`)
  const totals = computeTotals(d.lines, d.stamp)
  const seller = school.invoice
  const [reaOffice, reaNumber] = school.rea.split('-')
  const sdi = (c.sdi_code.trim() || '0000000').toUpperCase()
  const usePec = sdi === '0000000' && c.pec.trim()
  const method = paymentMethods.find((m) => m.value === d.payment_method)?.code ?? 'MP05'

  const linesXml = d.lines
    .map((l, i) => {
      const vat =
        l.vat_rate === 0
          ? `<AliquotaIVA>0.00</AliquotaIVA>
        <Natura>${l.nature || 'N4'}</Natura>`
          : `<AliquotaIVA>${money(l.vat_rate)}</AliquotaIVA>`
      return `<DettaglioLinee>
        <NumeroLinea>${i + 1}</NumeroLinea>
        <Descrizione>${text(l.description, 1000)}</Descrizione>
        <Quantita>${l.quantity.toFixed(2)}</Quantita>
        <PrezzoUnitario>${money(l.unit_price)}</PrezzoUnitario>
        <PrezzoTotale>${money(lineTotal(l))}</PrezzoTotale>
        ${vat}
      </DettaglioLinee>`
    })
    .join('\n      ')

  const summaryXml = totals.summary
    .map((g) => {
      const law = vatNatures.find((n) => n.code === g.nature)?.law ?? 'Operazione senza IVA'
      return g.vatRate === 0
        ? `<DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>${g.nature}</Natura>
        <ImponibileImporto>${money(g.taxable)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>${text(law, 100)}</RiferimentoNormativo>
      </DatiRiepilogo>`
        : `<DatiRiepilogo>
        <AliquotaIVA>${money(g.vatRate)}</AliquotaIVA>
        <ImponibileImporto>${money(g.taxable)}</ImponibileImporto>
        <Imposta>${money(g.vat)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>`
    })
    .join('\n      ')

  const stamp = totals.stamp
    ? `
        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>${money(totals.stamp)}</ImportoBollo>
        </DatiBollo>`
    : ''
  const causale = d.causale.trim()
    ? `\n        <Causale>${text(d.causale, 200)}</Causale>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${school.vatNumber}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${progressive}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${sdi}</CodiceDestinatario>${
        usePec ? `\n      <PECDestinatario>${text(c.pec, 256)}</PECDestinatario>` : ''
      }
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${school.vatNumber}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${school.vatNumber}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${text(seller.legalName, 80)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${seller.taxRegime}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${text(seller.street, 60)}</Indirizzo>
        <CAP>${seller.postalCode}</CAP>
        <Comune>${text(seller.city, 60)}</Comune>
        <Provincia>${seller.province}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
      <IscrizioneREA>
        <Ufficio>${reaOffice}</Ufficio>
        <NumeroREA>${reaNumber}</NumeroREA>
        <StatoLiquidazione>LN</StatoLiquidazione>
      </IscrizioneREA>
    </CedentePrestatore>
    ${partyXml(c)}
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${d.doc_type}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${d.invoice_date}</Data>
        <Numero>${text(d.number, 20)}</Numero>${stamp}
        <ImportoTotaleDocumento>${money(totals.total)}</ImportoTotaleDocumento>${causale}
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      ${linesXml}
      ${summaryXml}
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>${method}</ModalitaPagamento>
        <DataScadenzaPagamento>${d.payment_due ?? d.invoice_date}</DataScadenzaPagamento>
        <ImportoPagamento>${money(totals.total)}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
`
}

function firstByLocalName(root: Document | Element, name: string): Element | null {
  return root.getElementsByTagNameNS('*', name)[0] ?? root.getElementsByTagName(name)[0] ?? null
}

function allByLocalName(root: Document | Element, name: string): Element[] {
  const ns = [...root.getElementsByTagNameNS('*', name)]
  return ns.length ? ns : [...root.getElementsByTagName(name)]
}

function txt(root: Element | null, name: string): string {
  return (root && firstByLocalName(root, name)?.textContent?.trim()) || ''
}

function num(value: string): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function partyName(party: Element | null): string {
  if (!party) return ''
  const den = txt(party, 'Denominazione')
  if (den) return den
  return [txt(party, 'Cognome'), txt(party, 'Nome')].filter(Boolean).join(' ')
}

/** Anagrafica di cedente o cessionario come scritta nell'XML. */
export interface ParsedParty {
  companyName: string
  firstName: string
  lastName: string
  vatNumber: string
  taxCode: string
  address: string
  postalCode: string
  city: string
  province: string
  country: string
}

function parseParty(party: Element | null): ParsedParty {
  const id = party && firstByLocalName(party, 'IdFiscaleIVA')
  const seat = party && firstByLocalName(party, 'Sede')
  return {
    companyName: txt(party, 'Denominazione'),
    firstName: txt(party, 'Nome'),
    lastName: txt(party, 'Cognome'),
    vatNumber: id ? txt(id, 'IdCodice') : '',
    taxCode: txt(party, 'CodiceFiscale'),
    address: [txt(seat, 'Indirizzo'), txt(seat, 'NumeroCivico')].filter(Boolean).join(' '),
    postalCode: txt(seat, 'CAP'),
    city: txt(seat, 'Comune'),
    province: txt(seat, 'Provincia'),
    country: txt(seat, 'Nazione') || 'IT',
  }
}

/** Dati principali letti dall'XML di una fattura (emessa o ricevuta). */
export interface ParsedInvoice {
  docType: string
  number: string
  date: string
  sellerName: string
  sellerVat: string
  sellerTaxCode: string
  buyerName: string
  buyerVat: string
  buyerTaxCode: string
  taxable: number | null
  vat: number | null
  stamp: number | null
  total: number | null
  causale: string
  paymentDue: string
  lines: InvoiceLine[]
  seller: ParsedParty
  buyer: ParsedParty
  /** Codice destinatario e PEC del cessionario (dati di trasmissione). */
  buyerSdiCode: string
  buyerPec: string
}

export function parseFatturaPa(xml: string): ParsedInvoice {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML della fattura non leggibile')
  const general = firstByLocalName(doc, 'DatiGeneraliDocumento')
  if (!general) throw new Error('Non è una fattura elettronica valida')
  const seller = firstByLocalName(doc, 'CedentePrestatore')
  const buyer = firstByLocalName(doc, 'CessionarioCommittente')
  const idCode = (party: Element | null) => {
    const id = party && firstByLocalName(party, 'IdFiscaleIVA')
    return id ? txt(id, 'IdCodice') : ''
  }

  const summaries = allByLocalName(doc, 'DatiRiepilogo')
  const taxable = summaries.length
    ? round2(summaries.reduce((s, r) => s + (num(txt(r, 'ImponibileImporto')) ?? 0), 0))
    : null
  const vat = summaries.length
    ? round2(summaries.reduce((s, r) => s + (num(txt(r, 'Imposta')) ?? 0), 0))
    : null
  const stamp = num(txt(general, 'ImportoBollo'))
  const declared = num(txt(general, 'ImportoTotaleDocumento'))
  const total =
    declared ?? (taxable != null && vat != null ? round2(taxable + vat + (stamp ?? 0)) : null)

  const lines: InvoiceLine[] = allByLocalName(doc, 'DettaglioLinee').map((l) => {
    const quantity = num(txt(l, 'Quantita')) ?? 1
    const lineTotalValue = num(txt(l, 'PrezzoTotale')) ?? 0
    return {
      description: txt(l, 'Descrizione'),
      quantity,
      unit_price: num(txt(l, 'PrezzoUnitario')) ?? lineTotalValue,
      vat_rate: num(txt(l, 'AliquotaIVA')) ?? 0,
      nature: txt(l, 'Natura'),
    }
  })

  const payment = firstByLocalName(doc, 'DettaglioPagamento')
  return {
    docType: txt(general, 'TipoDocumento'),
    number: txt(general, 'Numero'),
    date: txt(general, 'Data'),
    sellerName: partyName(seller),
    sellerVat: idCode(seller),
    sellerTaxCode: txt(seller, 'CodiceFiscale'),
    buyerName: partyName(buyer),
    buyerVat: idCode(buyer),
    buyerTaxCode: txt(buyer, 'CodiceFiscale'),
    taxable,
    vat,
    stamp,
    total,
    causale: allByLocalName(general, 'Causale').map((c) => c.textContent?.trim()).filter(Boolean).join(' '),
    paymentDue: txt(payment, 'DataScadenzaPagamento'),
    lines,
    seller: parseParty(seller),
    buyer: parseParty(buyer),
    buyerSdiCode: txt(firstByLocalName(doc, 'DatiTrasmissione'), 'CodiceDestinatario'),
    buyerPec: txt(firstByLocalName(doc, 'DatiTrasmissione'), 'PECDestinatario'),
  }
}
