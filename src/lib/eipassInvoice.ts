import { school } from '../data/school'
import type { EipassCandidate } from '../types/db'

/** Modalità di pagamento proposte nella scheda, con il codice FatturaPA corrispondente. */
export const paymentMethods = [
  { value: 'contanti', label: 'Contanti', code: 'MP01' },
  { value: 'bonifico', label: 'Bonifico', code: 'MP05' },
  { value: 'carta', label: 'Carta / POS', code: 'MP08' },
  { value: 'paypal', label: 'PayPal', code: 'MP08' },
  { value: 'assegno', label: 'Assegno', code: 'MP02' },
  { value: 'altro', label: 'Altro', code: 'MP05' },
] as const

export function paymentMethodLabel(value: string): string {
  return paymentMethods.find((m) => m.value === value)?.label ?? value
}

export const invoiceStatusLabels = {
  da_fatturare: 'Da fatturare',
  fatturato: 'Fatturato',
  non_richiesta: 'Fattura non richiesta',
} as const

/** Sopra questa soglia una fattura esente IVA richiede la marca da bollo da 2 €. */
const BOLLO_THRESHOLD = 77.47
const BOLLO_AMOUNT = 2

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function money(value: number): string {
  return round2(value).toFixed(2)
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Solo caratteri ammessi dal tracciato (Latin-1 di base), entro la lunghezza massima. */
function text(value: string, max: number): string {
  const clean = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return xmlEscape(clean.slice(0, max))
}

export type InvoiceAmounts = {
  taxable: number
  vat: number
  total: number
  vatRate: number
  stamp: number
}

/** Scorpora l'IVA dal totale pagato (IVA inclusa). */
export function invoiceAmounts(total: number, vatRate: number): InvoiceAmounts {
  const taxable = round2(total / (1 + vatRate / 100))
  const vat = round2(total - taxable)
  const stamp = vatRate === 0 && taxable > BOLLO_THRESHOLD ? BOLLO_AMOUNT : 0
  return { taxable, vat, total: round2(total), vatRate, stamp }
}

/** Cosa manca per poter generare la fattura elettronica. */
export function invoiceMissingFields(c: EipassCandidate): string[] {
  const missing: string[] = []
  if (!c.amount || c.amount <= 0) missing.push('importo pagato')
  if (!/^[A-Z0-9]{16}$/.test(c.tax_code.trim().toUpperCase())) missing.push('codice fiscale')
  if (!c.address.trim()) missing.push('indirizzo')
  if (!/^\d{5}$/.test(c.postal_code.trim())) missing.push('CAP')
  if (!c.city.trim()) missing.push('città')
  if (!c.invoice_number.trim()) missing.push('numero fattura')
  if (!c.invoice_date) missing.push('data fattura')
  return missing
}

/** Prossimo numero fattura dell'anno: il più alto numero iniziale trovato, più uno. */
export function nextInvoiceNumber(
  existing: Pick<EipassCandidate, 'invoice_number' | 'invoice_date'>[],
  year: number,
): string {
  let max = 0
  for (const row of existing) {
    if (!row.invoice_date?.startsWith(String(year))) continue
    const match = /^\s*(\d+)/.exec(row.invoice_number)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return String(max + 1)
}

export function invoiceFileName(progressive: string): string {
  return `IT${school.vatNumber}_${progressive}.xml`
}

/** Progressivo d'invio: 5 caratteri alfanumerici. */
export function randomProgressive(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/**
 * Fattura elettronica verso privato (FPR12) per l'acquisto EIPASS.
 * Il file si carica su Aruba Fatturazione Elettronica («Carica fattura» XML), che la firma e invia allo SdI.
 */
export function buildEipassInvoiceXml(c: EipassCandidate, progressive = randomProgressive()): string {
  const missing = invoiceMissingFields(c)
  if (missing.length) throw new Error(`Per generare la fattura mancano: ${missing.join(', ')}`)

  const amounts = invoiceAmounts(c.amount!, c.vat_rate)
  const method = paymentMethods.find((m) => m.value === c.payment_method)?.code ?? 'MP05'
  const description = `Certificazione ${c.certification.trim() || 'EIPASS'} - ${c.last_name} ${c.first_name}`
  const exempt = amounts.vatRate === 0
  const seller = school.invoice
  const paymentDate = c.payment_date ?? c.invoice_date!
  const docTotal = amounts.total + amounts.stamp

  const vatLine = exempt
    ? `<AliquotaIVA>0.00</AliquotaIVA>\n          <Natura>N4</Natura>`
    : `<AliquotaIVA>${money(amounts.vatRate)}</AliquotaIVA>`
  const summaryVat = exempt
    ? `<AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N4</Natura>
        <ImponibileImporto>${money(amounts.taxable)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>Esente art. 10 DPR 633/72</RiferimentoNormativo>`
    : `<AliquotaIVA>${money(amounts.vatRate)}</AliquotaIVA>
        <ImponibileImporto>${money(amounts.taxable)}</ImponibileImporto>
        <Imposta>${money(amounts.vat)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>`
  const stamp = amounts.stamp
    ? `
        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>${money(amounts.stamp)}</ImportoBollo>
        </DatiBollo>`
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
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${school.vatNumber}</IdCodice>
        </IdFiscaleIVA>
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
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>${c.tax_code.trim().toUpperCase()}</CodiceFiscale>
        <Anagrafica>
          <Nome>${text(c.first_name, 60)}</Nome>
          <Cognome>${text(c.last_name, 60)}</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${text(c.address, 60)}</Indirizzo>
        <CAP>${c.postal_code.trim()}</CAP>
        <Comune>${text(c.city, 60)}</Comune>${
          /^[A-Z]{2}$/.test(c.province.trim().toUpperCase())
            ? `\n        <Provincia>${c.province.trim().toUpperCase()}</Provincia>`
            : ''
        }
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${c.invoice_date}</Data>
        <Numero>${text(c.invoice_number, 20)}</Numero>${stamp}
        <ImportoTotaleDocumento>${money(docTotal)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>${text(description, 1000)}</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>${money(amounts.taxable)}</PrezzoUnitario>
        <PrezzoTotale>${money(amounts.taxable)}</PrezzoTotale>
        ${vatLine}
      </DettaglioLinee>
      <DatiRiepilogo>
        ${summaryVat}
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>${method}</ModalitaPagamento>
        <DataScadenzaPagamento>${paymentDate}</DataScadenzaPagamento>
        <ImportoPagamento>${money(docTotal)}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
`
}

export type ImportedInvoice = {
  number: string
  date: string
  taxCode: string
  total: number | null
  fileName: string
}

function firstByLocalName(root: Document | Element, name: string): Element | null {
  return root.getElementsByTagNameNS('*', name)[0] ?? root.getElementsByTagName(name)[0] ?? null
}

/** Legge una fattura FatturaPA (es. scaricata da Aruba) e ne estrae numero, data e cliente. */
export function parseInvoiceXml(xml: string, fileName = ''): ImportedInvoice {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error(`${fileName || 'File'}: XML non leggibile`)
  }
  const general = firstByLocalName(doc, 'DatiGeneraliDocumento')
  const buyer = firstByLocalName(doc, 'CessionarioCommittente')
  const number = general && firstByLocalName(general, 'Numero')?.textContent?.trim()
  const date = general && firstByLocalName(general, 'Data')?.textContent?.trim()
  if (!general || !buyer || !number || !date) {
    throw new Error(`${fileName || 'File'}: non è una fattura elettronica valida`)
  }
  const taxCode =
    firstByLocalName(buyer, 'CodiceFiscale')?.textContent?.trim().toUpperCase() ??
    firstByLocalName(buyer, 'IdCodice')?.textContent?.trim().toUpperCase() ??
    ''
  const totalText = firstByLocalName(general, 'ImportoTotaleDocumento')?.textContent?.trim()
  return {
    number,
    date,
    taxCode,
    total: totalText ? Number(totalText) : null,
    fileName,
  }
}

/**
 * Abbina una fattura importata a un corsista: stesso codice fiscale; se più corsisti
 * hanno lo stesso codice, preferisce chi è ancora da fatturare con lo stesso importo.
 */
export function matchInvoiceToCandidate(
  invoice: ImportedInvoice,
  candidates: EipassCandidate[],
): EipassCandidate | null {
  const sameTaxCode = candidates.filter(
    (c) => invoice.taxCode && c.tax_code.trim().toUpperCase() === invoice.taxCode,
  )
  if (sameTaxCode.length === 0) return null
  const alreadyThis = sameTaxCode.find((c) => c.invoice_number.trim() === invoice.number)
  if (alreadyThis) return alreadyThis
  const pending = sameTaxCode.filter((c) => c.invoice_status === 'da_fatturare')
  const pool = pending.length ? pending : sameTaxCode
  const sameAmount = pool.find(
    (c) => invoice.total != null && c.amount != null && Math.abs(c.amount - invoice.total) < 0.01,
  )
  return sameAmount ?? pool[0]
}
