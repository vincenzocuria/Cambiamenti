import type { Page } from 'playwright-core'

/**
 * Chiamate interne del pannello Aruba (le stesse che fa la pagina), eseguite dentro il browser
 * già autenticato: valgono i cookie della sessione più le intestazioni aru-* che il pannello
 * aggiunge a ogni richiesta e che qui si copiano dalla prima richiesta vista.
 */
export class PanelApi {
  private headers: Record<string, string> | null = null
  private page: Page

  constructor(page: Page) {
    this.page = page
    page.on('request', (req) => {
      if (this.headers) return
      const h = req.headers()
      if (h['aru-sub'] !== undefined) {
        this.headers = Object.fromEntries(Object.entries(h).filter(([k]) => k.startsWith('aru-')))
      }
    })
  }

  /** Aspetta che il pannello faccia una sua chiamata, così si conoscono le intestazioni aru-*. */
  async ready(timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    let reloaded = false
    while (!this.headers) {
      if (Date.now() > deadline) throw new Error('Il pannello Aruba non ha risposto: rilancia con «accedi»')
      if (!reloaded && Date.now() > deadline - timeoutMs / 2) {
        reloaded = true
        await this.page.reload({ waitUntil: 'domcontentloaded' })
      }
      await this.page.waitForTimeout(500)
    }
  }

  /** Impostazioni della sessione che la pagina passa al caricamento (tracciato SdI, OTP). */
  async panelContext(): Promise<{ tracciato: unknown; otp: { tipo: unknown; valore: unknown } }> {
    return this.page.evaluate(() => {
      const w = window as unknown as {
        FepaGlobalData?: Record<string, unknown>
        Ext?: { getApplication?: () => { getMainView: () => { getViewModel: () => { get: (k: string) => unknown } } } }
      }
      let otp = { tipo: null as unknown, valore: null as unknown }
      try {
        const vm = w.Ext?.getApplication?.().getMainView().getViewModel()
        const cred = vm?.get('recordCredentialSession') as { get: (k: string) => unknown } | undefined
        otp = { tipo: vm?.get('getDefaultMfaType') ?? null, valore: cred?.get('allowedCode') ?? null }
      } catch {
        /* pannello non ancora pronto */
      }
      return { tracciato: w.FepaGlobalData?.tracciatoSdiAbilitato ?? 'V_1_2', otp }
    })
  }

  async post<T>(servicePath: string, body: unknown): Promise<T> {
    await this.ready()
    const result = await this.page.evaluate(
      async ({ url, body, headers }) => {
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...headers,
            'content-type': 'application/json',
            accept: 'application/json',
            'x-requested-with': 'XMLHttpRequest',
          },
          body: JSON.stringify(body),
        })
        return { status: res.status, text: await res.text() }
      },
      { url: new URL(servicePath, this.page.url()).href, body, headers: this.headers ?? {} },
    )
    if (result.status === 401 || result.status === 403) {
      throw new Error('Sessione Aruba scaduta: rilancia con «accedi»')
    }
    if (result.status >= 400) throw new Error(`${servicePath}: errore ${result.status} ${result.text.slice(0, 200)}`)
    return (result.text ? JSON.parse(result.text) : {}) as T
  }
}

export interface PanelInvoiceItem {
  Id: string
  Numero: string
  Data: string
  Stato?: number
  FileName?: string
  SdiFileName?: string
  IdSdi?: string
  Mittente?: string
  TotaleDocumento?: number
  /** 0 non incassata, 1 incassata, 2 non gestita, 3 parzialmente, 4 stornata. */
  StatoPagInc?: number
  DataPagInc?: string
}

interface SearchPage {
  Count: number
  Pages: number
  PageNumber: number
  Items: PanelInvoiceItem[]
}

export type Direction = 'out' | 'in'

const SERVICES: Record<Direction, { search: string; xml: string }> = {
  out: {
    search: '/services/FatturaFrontEnd/advancedSearch',
    xml: '/services/FatturaFrontEnd/ExtractXmlInvoiceSend',
  },
  in: {
    search: '/services/FatturaRicevutaFrontEnd/advancedSearch',
    xml: '/services/FatturaRicevutaFrontEnd/ExtractXmlInvoiceReceived',
  },
}

/** Stati delle fatture emesse come li scrive il pannello. */
export const OUT_STATES: Record<number, string> = {
  1: 'Presa in carico',
  2: 'Errore elaborazione',
  3: 'Inviata',
  4: 'Scartata',
  5: 'Emessa e non consegnata',
  6: 'Recapito impossibile',
  7: 'Emessa e consegnata',
  8: 'Accettata',
  9: 'Rifiutata',
  10: 'Decorrenza termini',
  51: 'Emessa',
  52: 'Emessa e inviata',
  53: 'Annullata',
}

/** Emesse che non valgono come fattura (non si importano). */
export const OUT_INVALID_STATES = new Set([2, 4, 53])

/** Tutte le fatture emesse o ricevute di un anno (elenco, senza XML). */
export async function listInvoices(api: PanelApi, direction: Direction, year: number): Promise<PanelInvoiceItem[]> {
  const items: PanelInvoiceItem[] = []
  for (let page = 1; ; page++) {
    const res = await api.post<SearchPage>(SERVICES[direction].search, {
      PageNumber: page,
      PageSize: null,
      AnnoFiscale: year,
    })
    items.push(...(res.Items ?? []))
    if (!res.Items?.length || page >= (res.Pages || 1)) break
  }
  return items
}

/** File della fattura (XML o P7M) come byte. */
export async function downloadInvoice(
  api: PanelApi,
  direction: Direction,
  id: string,
  year: number,
): Promise<{ name: string; bytes: Uint8Array }> {
  const res = await api.post<{ Content: string; ContentFileName: string }>(SERVICES[direction].xml, {
    Id: id,
    AnnoFiscale: year,
  })
  return { name: res.ContentFileName || `${id}.xml`, bytes: decodeContent(res.Content) }
}

/** Il pannello restituisce il file in base64; se fosse già XML in chiaro lo tiene com'è. */
export function decodeContent(content: string): Uint8Array {
  const trimmed = (content ?? '').trim()
  if (trimmed.startsWith('<')) return new TextEncoder().encode(trimmed)
  return new Uint8Array(Buffer.from(trimmed.replace(/^data:[^,]*,/, ''), 'base64'))
}

/** Data del pannello (a volte con orario UTC) come giorno italiano AAAA-MM-GG. */
export function panelDate(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value.slice(0, 10)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
}

export interface UploadCheck {
  ok: boolean
  messages: string[]
}

/**
 * Carica un XML nelle BOZZE del pannello Aruba (non lo invia allo SdI): lo controlla come fa
 * la pagina «Carica fattura» e poi lo salva in bozza. L'invio vero si fa dal pannello.
 */
export async function uploadToDrafts(api: PanelApi, fileName: string, xml: string): Promise<UploadCheck> {
  const base64 = Buffer.from(xml, 'utf8').toString('base64')
  const ctx = await api.panelContext()
  const check = await api.post<Record<string, unknown>>('/services/FatturaFrontEnd/CheckInvoiceForUpload', {
    FileName: fileName,
    FileBase64: base64,
    TracciatoSdiAbilitato: ctx.tracciato,
  })
  const errors = collectMessages(check, /errori|errors/i)
  if (errors.length) return { ok: false, messages: errors }
  await api.post('/services/FatturaFrontEnd/SaveUploadInvoiceToDraft', {
    FileBase64: base64,
    PdfOption: {},
    IdRefLogo: null,
    ModalitaPrezzo: null,
    TracciatoSdiAbilitato: ctx.tracciato,
    Otp: ctx.otp,
    ForzaUpload: false,
  })
  return { ok: true, messages: collectMessages(check, /warning/i) }
}

/** Testi di errore/avviso in una risposta del pannello (liste con Descrizione/Message). */
function collectMessages(obj: unknown, key: RegExp, out: string[] = []): string[] {
  if (Array.isArray(obj)) obj.forEach((v) => collectMessages(v, key, out))
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (key.test(k) && Array.isArray(v)) {
        for (const e of v) {
          if (e && typeof e === 'object') {
            const r = e as Record<string, unknown>
            const text = r.DescrizioneErrore ?? r.Descrizione ?? r.Message ?? r.descrizione
            if (text) out.push(String(text))
          } else if (e) out.push(String(e))
        }
      } else if (v && typeof v === 'object') collectMessages(v, key, out)
    }
  }
  return out
}
