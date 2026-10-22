import fs from 'node:fs'
import path from 'node:path'
import type { BrowserContext, Page, Request, Response } from 'playwright-core'
import { dataDir } from './env'
import { ensureLoggedIn, openBrowser } from './browser'

/**
 * Esplorazione guidata del pannello: mentre tu navighi, registra come è fatto (indirizzi delle
 * pagine, chiamate interne, pulsanti) senza salvare valori: niente token, cookie, importi o
 * nomi dei clienti. Il file serve a Claude per completare scarico e invio automatici.
 */

type Shape = string | Shape[] | { [k: string]: Shape }

/** Struttura di un JSON (chiavi e tipi), senza i valori. */
function shape(value: unknown, depth = 0): Shape {
  if (depth > 6) return '…'
  if (Array.isArray(value)) return value.length ? [shape(value[0], depth + 1)] : []
  if (value && typeof value === 'object') {
    const out: Record<string, Shape> = {}
    for (const [k, v] of Object.entries(value).slice(0, 60)) out[k] = shape(v, depth + 1)
    return out
  }
  return value === null ? 'null' : typeof value
}

/** Indirizzo senza valori nei parametri (restano solo i nomi). */
function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw)
    const keys = [...u.searchParams.keys()]
    const path = u.pathname.replace(/\/[0-9a-f-]{16,}|\/\d{4,}/gi, '/{id}')
    return `${u.origin}${path}${keys.length ? `?${keys.map((k) => `${k}=…`).join('&')}` : ''}`
  } catch {
    return raw.slice(0, 200)
  }
}

interface ApiCall {
  method: string
  url: string
  status: number
  type: string
  requestHeaders: string[]
  requestBody?: Shape
  response?: Shape
  count: number
}

export async function explore(): Promise<void> {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, 'esplorazione-aruba.json')
  const calls = new Map<string, ApiCall>()
  const pages = new Map<string, { url: string; title: string; controls: string[] }>()
  const downloads: { url: string; fileName: string }[] = []
  const uploads: string[] = []

  const context: BrowserContext = await openBrowser()
  const save = () =>
    fs.writeFileSync(
      file,
      JSON.stringify(
        { savedAt: new Date().toISOString(), pages: [...pages.values()], calls: [...calls.values()], downloads, uploads },
        null,
        2,
      ),
    )

  async function onResponse(res: Response) {
    const req: Request = res.request()
    const kind = req.resourceType()
    if (kind !== 'xhr' && kind !== 'fetch' && kind !== 'document') return
    const key = `${req.method()} ${cleanUrl(req.url())}`
    const existing = calls.get(key)
    if (existing) {
      existing.count++
      return
    }
    const type = res.headers()['content-type'] ?? ''
    const call: ApiCall = {
      method: req.method(),
      url: cleanUrl(req.url()),
      status: res.status(),
      type,
      requestHeaders: Object.keys(await req.allHeaders().catch(() => ({}))).filter(
        (h) => !h.startsWith('sec-') && !['accept-language', 'user-agent'].includes(h),
      ),
      count: 1,
    }
    const body = req.postData()
    if (body) {
      try {
        call.requestBody = shape(JSON.parse(body))
      } catch {
        call.requestBody = `testo/form (${body.length} caratteri): ${[...new URLSearchParams(body).keys()].join(', ')}`
      }
    }
    if (type.includes('json')) call.response = shape(await res.json().catch(() => null))
    calls.set(key, call)
    save()
  }

  async function snapshot(page: Page) {
    try {
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      const controls = await page.evaluate(() => {
        const describe = (el: Element) => {
          const h = el as HTMLElement & { name?: string; type?: string }
          const label =
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            (h.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60) ||
            el.getAttribute('placeholder') ||
            ''
          // Le cifre (importi, numeri, partite IVA) non servono e non si salvano
          const safe = label.replace(/\d/g, '#')
          const attrs = [
            el.id && `#${el.id}`,
            h.name && `name=${h.name}`,
            h.type && `type=${h.type}`,
            el.getAttribute('data-testid') && `testid=${el.getAttribute('data-testid')}`,
            el.getAttribute('formcontrolname') && `fc=${el.getAttribute('formcontrolname')}`,
          ]
            .filter(Boolean)
            .join(' ')
          return `${el.tagName.toLowerCase()} ${attrs} «${safe}»`
        }
        const all = document.querySelectorAll(
          'button, a[href], input, select, [role="button"], [role="tab"], [role="menuitem"]',
        )
        // Le righe ripetute delle tabelle (nomi dei clienti) si riducono a poche
        const seen = new Map<string, number>()
        const out: string[] = []
        for (const el of all) {
          if (el.closest('tbody tr:nth-child(n+3)')) continue
          const d = describe(el)
          const n = (seen.get(d) ?? 0) + 1
          seen.set(d, n)
          if (n === 1) out.push(d)
          if (out.length >= 300) break
        }
        return out
      })
      const url = cleanUrl(page.url())
      pages.set(url, { url, title: (await page.title()).replace(/\d/g, '#'), controls })
      save()
    } catch {
      /* pagina chiusa durante la lettura */
    }
  }

  function watch(page: Page) {
    page.on('response', (r) => void onResponse(r))
    page.on('load', () => void snapshot(page))
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) setTimeout(() => void snapshot(page), 1500)
    })
    page.on('download', (d) => {
      downloads.push({ url: cleanUrl(d.url()), fileName: d.suggestedFilename().replace(/\d/g, '#') })
      save()
    })
    page.on('filechooser', () => {
      uploads.push(cleanUrl(page.url()))
      save()
    })
  }

  context.pages().forEach(watch)
  context.on('page', watch)
  const page = context.pages()[0] ?? (await context.newPage())
  await ensureLoggedIn(page)
  await snapshot(page)

  console.log(`
Sei dentro il pannello Aruba. Ora, con calma:
  1. apri le Fatture emesse e scarica una fattura (e, se c'è, lo scarico multiplo / ZIP);
  2. apri le Fatture ricevute e scarica una fattura;
  3. apri «Carica fattura» (o «Nuova fattura → da file») e clicca il pulsante per scegliere il
     file: la finestra di scelta non si apre, è normale, lo script registra solo il pulsante.
     Non inviare niente;
  4. chiudi la finestra del browser.
Lo script registra solo la struttura delle pagine in:
  ${file}
`)
  await new Promise<void>((resolve) => context.on('close', () => resolve()))
  save()
  console.log(`Fatto. File salvato: ${file}`)
}
