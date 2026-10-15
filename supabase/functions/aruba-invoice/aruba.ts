/** Client minimo per le API di Aruba Fatturazione Elettronica (ambiente di produzione). */
const AUTH_URL = 'https://auth.fatturazioneelettronica.aruba.it'
const WS_URL = 'https://ws.fatturazioneelettronica.aruba.it'

export class ArubaError extends Error {}

export async function arubaLogin(username: string, password: string): Promise<string> {
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
  const token = (JSON.parse(text) as { access_token?: string }).access_token
  if (!token) throw new ArubaError('Login Aruba senza token di accesso')
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

interface ArubaSentPage {
  errorCode?: string
  errorDescription?: string
  content?: { invoices?: { number?: string; invoiceDate?: string }[] }[]
  last?: boolean
  totalPages?: number
  totalElements?: number
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

/**
 * Numero più alto tra le fatture emesse nell'anno su Aruba (anche quelle create
 * fuori dall'app), così la numerazione dell'app prosegue senza duplicati.
 */
export async function arubaLastInvoiceNumber(
  token: string,
  username: string,
  year: number,
  sender: { countryCode: string; vatCode: string },
): Promise<ArubaLastNumber> {
  let max = 0
  let found = 0
  let sample: string | null = null
  for (let page = 1; page <= 50; page++) {
    const params = new URLSearchParams({
      username,
      page: String(page),
      size: '100',
      startDate: `${year}-01-01T00:00:00.000Z`,
      endDate: new Date().toISOString(),
    })
    // Obbligatori per le utenze Premium, innocui per le altre
    if (sender.vatCode) {
      params.set('countrySender', sender.countryCode)
      params.set('vatcodeSender', sender.vatCode)
    }
    const res = await fetch(`${WS_URL}/services/invoice/out/findByUsername?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new ArubaError(`Elenco fatture Aruba non leggibile (HTTP ${res.status})`)
    const body = (await res.json()) as ArubaSentPage
    if (body.errorCode && body.errorCode !== '0000') {
      throw new ArubaError(
        `Elenco fatture Aruba non leggibile: ${body.errorDescription || body.errorCode}`,
      )
    }
    for (const doc of body.content ?? []) {
      for (const inv of doc.invoices ?? []) {
        if (inv.invoiceDate && !inv.invoiceDate.startsWith(String(year))) continue
        found++
        sample ??= inv.number ?? null
        const n = parseInvoiceNumber(inv.number ?? '', year)
        if (n != null) max = Math.max(max, n)
      }
    }
    if (body.last !== false || !body.content?.length) break
  }
  return { lastNumber: max, found, sample }
}
