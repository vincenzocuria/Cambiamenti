/** Client minimo per le API di Aruba Fatturazione Elettronica (ambiente di produzione). */
const AUTH_URL = 'https://auth.fatturazioneelettronica.aruba.it'
const WS_URL = 'https://ws.fatturazioneelettronica.aruba.it'

export class ArubaError extends Error {}

// Token riusato finché l'istanza resta calda: Aruba limita i login al minuto
let cachedToken: { user: string; token: string; expiresAt: number } | null = null

export async function arubaLogin(username: string, password: string): Promise<string> {
  if (cachedToken && cachedToken.user === username && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }
  const res = await fetch(`${AUTH_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ grant_type: 'password', username, password }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new ArubaError(
      res.status === 401 || res.status === 400
        ? 'Aruba ha rifiutato utente o password'
        : `Login Aruba non riuscito (HTTP ${res.status})`,
    )
  }
  const parsed = JSON.parse(text) as { access_token?: string; expires_in?: number }
  const token = parsed.access_token
  if (!token) throw new ArubaError('Login Aruba senza token di accesso')
  // Margine di un minuto sulla scadenza dichiarata (di solito 30 minuti)
  const ttl = Math.max(60, (parsed.expires_in ?? 1800) - 60) * 1000
  cachedToken = { user: username, token, expiresAt: Date.now() + ttl }
  return token
}

export async function arubaUserInfo(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${AUTH_URL}/auth/userInfo`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new ArubaError(`Profilo Aruba non leggibile (HTTP ${res.status})`)
  return (await res.json()) as Record<string, unknown>
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/** Carica una fattura XML non firmata: Aruba la firma e la invia allo SdI. */
export async function arubaUploadInvoice(token: string, xml: string): Promise<string> {
  const res = await fetch(`${WS_URL}/services/invoice/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    },
    body: JSON.stringify({ dataFile: toBase64(xml), credential: '', domain: '' }),
  })
  const text = await res.text()
  let body: { errorCode?: string; errorDescription?: string; uploadFileName?: string } = {}
  try {
    body = JSON.parse(text)
  } catch {
    /* risposta non JSON */
  }
  if (!res.ok || (body.errorCode && body.errorCode !== '0000')) {
    throw new ArubaError(
      `Aruba ha rifiutato la fattura: ${body.errorDescription || body.errorCode || `HTTP ${res.status}`}`,
    )
  }
  return body.uploadFileName ?? ''
}

/**
 * Numero più alto tra le fatture emesse nell'anno su Aruba (anche quelle create
 * fuori dall'app), così la numerazione dell'app prosegue senza duplicati.
 */
export async function arubaLastInvoiceNumber(
  token: string,
  account: ArubaAccount,
  year: number,
): Promise<ArubaLastNumber> {
  let max = 0
  let found = 0
  let sample: string | null = null
  for (let page = 1; page <= 50; page++) {
    const { items, last } = await arubaListInvoices(token, 'out', account, year, page)
    for (const h of items) {
      if (h.date && !h.date.startsWith(String(year))) continue
      found++
      sample ??= h.number || null
      const n = parseInvoiceNumber(h.number, year)
      if (n != null) max = Math.max(max, n)
    }
    if (last) break
  }
  return { lastNumber: max, found, sample }
}

/**
 * Numero progressivo da un numero fattura Aruba: «44», «44/2026», «FPR 44/26», «2026/44».
 * Scarta i gruppi che coincidono con l'anno (4 o 2 cifre) quando ce ne sono altri.
 */
export function parseInvoiceNumber(raw: string, year: number): number | null {
  const groups = raw.match(/\d+/g)
  if (!groups) return null
  const yearForms = new Set([String(year), String(year % 100).padStart(2, '0')])
  const progressive = groups.length > 1 ? groups.filter((g) => !yearForms.has(g)) : groups
  const pick = progressive[0] ?? groups[0]
  return Number(pick)
}

export interface ArubaLastNumber {
  lastNumber: number
  /** Fatture lette su Aruba nell'anno: serve a capire un risultato 0. */
  found: number
  /** Esempio di numero letto, per controllare il formato. */
  sample: string | null
}

/** Utente Aruba e P.IVA del titolare (obbligatoria negli elenchi per le utenze Premium). */
export interface ArubaAccount {
  username: string
  vatCode: string
  countryCode: string
}

export type ArubaDirection = 'out' | 'in'

interface ArubaParty {
  description?: string
  vatCode?: string
  fiscalCode?: string
  countryCode?: string
}

interface ArubaListDoc {
  filename?: string
  idSdi?: string | number
  docType?: string
  sender?: ArubaParty
  receiver?: ArubaParty
  invoices?: { number?: string; invoiceDate?: string; status?: string; statusDescription?: string }[]
}

/** Testata di una fattura nell'elenco Aruba, normalizzata. */
export interface ArubaInvoiceHeader {
  filename: string
  number: string
  date: string | null
  sdiId: string
  status: string
  statusLabel: string
  counterpartName: string
  counterpartVat: string
  counterpartTaxCode: string
}

function headerFrom(doc: ArubaListDoc, direction: ArubaDirection): ArubaInvoiceHeader | null {
  if (!doc.filename) return null
  const inv = doc.invoices?.[0] ?? {}
  const party = (direction === 'out' ? doc.receiver : doc.sender) ?? {}
  return {
    filename: doc.filename,
    number: (inv.number ?? '').trim(),
    date: inv.invoiceDate ? inv.invoiceDate.slice(0, 10) : null,
    sdiId: doc.idSdi != null ? String(doc.idSdi) : '',
    status: inv.status ?? '',
    statusLabel: inv.statusDescription ?? inv.status ?? '',
    counterpartName: party.description ?? '',
    counterpartVat: party.vatCode ?? '',
    counterpartTaxCode: party.fiscalCode ?? '',
  }
}

type ListPage = {
  content?: ArubaListDoc[]
  last?: boolean
  totalElements?: number
  totalPages?: number
  errorCode?: string
  errorDescription?: string
}

/**
 * Varianti dei parametri di ricerca: la documentazione Aruba non è univoca su numerazione
 * delle pagine e formato date. Si usa la prima che restituisce fatture e la si ricorda.
 */
const listVariants: ((year: number, page: number) => Record<string, string>)[] = [
  (year, page) => ({
    page: String(page),
    size: '100',
    startDate: `${year}-01-01T00:00:00.000Z`,
    endDate: new Date(Math.min(Date.now(), Date.UTC(year, 11, 31, 23, 59, 59))).toISOString(),
  }),
  (year, page) => ({
    page: String(page - 1),
    size: '100',
    startDate: `${year}-01-01T00:00:00.000Z`,
    endDate: new Date(Math.min(Date.now(), Date.UTC(year, 11, 31, 23, 59, 59))).toISOString(),
  }),
  (year, page) => ({
    page: String(page),
    size: '100',
    startDate: `${year}-01-01T00:00:00.000+01:00`,
    endDate: `${year}-12-31T23:59:59.000+01:00`,
  }),
  (_year, page) => ({ page: String(page), size: '100' }),
]
const workingVariant: Record<string, number> = {}

async function fetchListPage(
  token: string,
  direction: ArubaDirection,
  account: ArubaAccount,
  variant: number,
  year: number,
  page: number,
): Promise<{ status: number; body: ListPage | null }> {
  const params = new URLSearchParams({ username: account.username, ...listVariants[variant](year, page) })
  // Obbligatori per le utenze Premium, innocui per le altre
  if (account.vatCode) {
    const side = direction === 'out' ? 'Sender' : 'Receiver'
    params.set(`country${side}`, account.countryCode)
    params.set(`vatcode${side}`, account.vatCode)
  }
  const res = await fetch(`${WS_URL}/services/invoice/${direction}/findByUsername?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 429) throw new ArubaError('Aruba: troppe richieste, riprova tra un minuto')
  if (res.status === 401) cachedToken = null
  const text = await res.text()
  let body: ListPage | null = null
  try {
    body = JSON.parse(text) as ListPage
  } catch {
    /* non JSON */
  }
  // Solo struttura e conteggi nei log, nessun dato delle fatture
  console.log(
    `aruba list ${direction} v${variant} p${page}: HTTP ${res.status}, totalElements=${body?.totalElements}, content=${body?.content?.length}, keys=${body ? Object.keys(body).join(',') : text.slice(0, 120)}${
      body?.content?.[0] ? `, itemKeys=${Object.keys(body.content[0]).join(',')}` : ''
    }`,
  )
  if (body?.errorCode && body.errorCode !== '0000') {
    throw new ArubaError(`Elenco fatture Aruba non leggibile: ${body.errorDescription || body.errorCode}`)
  }
  return { status: res.status, body }
}

/** Una pagina dell'elenco fatture emesse (out) o ricevute (in) dell'anno. */
export async function arubaListInvoices(
  token: string,
  direction: ArubaDirection,
  account: ArubaAccount,
  year: number,
  page: number,
): Promise<{ items: ArubaInvoiceHeader[]; last: boolean }> {
  const known = workingVariant[direction]
  const candidates = known != null ? [known] : listVariants.map((_, i) => i)
  let lastStatus = 0
  for (const variant of candidates) {
    const { status, body } = await fetchListPage(token, direction, account, variant, year, page)
    lastStatus = status
    if (status >= 400 || !body) continue
    const docs = body.content ?? []
    // Pagina vuota alla prima richiesta: provo la variante successiva
    if (docs.length === 0 && known == null && page === 1) continue
    if (docs.length > 0) workingVariant[direction] = variant
    const items = docs
      .map((d) => headerFrom(d, direction))
      .filter((h): h is ArubaInvoiceHeader => h !== null)
    return { items, last: body.last !== false || items.length === 0 }
  }
  if (lastStatus >= 400) throw new ArubaError(`Elenco fatture Aruba non leggibile (HTTP ${lastStatus})`)
  return { items: [], last: true }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function indexOfBytes(hay: Uint8Array, needle: string, from = 0): number {
  const n = new TextEncoder().encode(needle)
  outer: for (let i = from; i <= hay.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer
    return i
  }
  return -1
}

function lastIndexOfBytes(hay: Uint8Array, needle: string): number {
  const n = new TextEncoder().encode(needle)
  outer: for (let i = hay.length - n.length; i >= 0; i--) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer
    return i
  }
  return -1
}

/**
 * Estrae l'XML della fattura dal file Aruba: XML semplice oppure firmato (.p7m),
 * anche se il .p7m è a sua volta in base64.
 */
export function extractInvoiceXml(fileBase64: string): string {
  let bytes = base64ToBytes(fileBase64)
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4))
  if (head.startsWith('MII')) bytes = base64ToBytes(new TextDecoder('latin1').decode(bytes))

  let start = indexOfBytes(bytes, '<?xml')
  if (start < 0) {
    const root = indexOfBytes(bytes, 'FatturaElettronica')
    start = root < 0 ? -1 : bytes.lastIndexOf(0x3c, root)
  }
  const endTag = lastIndexOfBytes(bytes, 'FatturaElettronica>')
  if (start < 0 || endTag < 0) throw new ArubaError('File fattura Aruba non leggibile')
  let slice = bytes.slice(start, endTag + 'FatturaElettronica>'.length)

  // .p7m con contenuto a blocchi: toglie le intestazioni DER (04 81 xx / 04 82 xx xx) tra i blocchi
  if (slice.some((b) => b < 0x09)) {
    const clean: number[] = []
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0x04 && slice[i + 1] === 0x82) {
        i += 3
        continue
      }
      if (slice[i] === 0x04 && slice[i + 1] === 0x81) {
        i += 2
        continue
      }
      clean.push(slice[i])
    }
    slice = new Uint8Array(clean)
  }
  return new TextDecoder('utf-8').decode(slice)
}

/** Scarica il file di una fattura (emessa o ricevuta) e ne restituisce l'XML. */
export async function arubaGetInvoiceXml(
  token: string,
  direction: ArubaDirection,
  filename: string,
): Promise<string> {
  const params = new URLSearchParams({ filename, includeFile: 'true', includePdf: 'false' })
  const res = await fetch(`${WS_URL}/services/invoice/${direction}/getByFilename?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 429) throw new ArubaError('Aruba: troppe richieste, riprova tra un minuto')
  if (!res.ok) throw new ArubaError(`File fattura non scaricabile da Aruba (HTTP ${res.status})`)
  const body = (await res.json()) as { file?: string }
  if (!body.file) throw new ArubaError('Aruba non ha restituito il file della fattura')
  return extractInvoiceXml(body.file)
}
