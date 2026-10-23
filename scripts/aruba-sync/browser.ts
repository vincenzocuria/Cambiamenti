import fs from 'node:fs'
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import { arubaCredentials, profileDir } from './env'

/** Pagina di partenza del pannello (si può cambiare con ARUBA_PANEL_URL). */
export const panelUrl = process.env.ARUBA_PANEL_URL || 'https://fatturazioneelettronica.aruba.it/'

/**
 * Apre Microsoft Edge (già installato su Windows, niente download) con un profilo dedicato:
 * cookie e «ricorda questo dispositivo» dell'OTP restano salvati tra un avvio e l'altro.
 */
export async function openBrowser(opts: { hidden?: boolean } = {}): Promise<BrowserContext> {
  fs.mkdirSync(profileDir, { recursive: true })
  const channel = process.env.ARUBA_BROWSER || 'msedge'
  try {
    return await chromium.launchPersistentContext(profileDir, {
      channel,
      // In headless il pannello Aruba non parte: «nascosto» = finestra vera ma fuori dallo schermo
      headless: false,
      acceptDownloads: true,
      viewport: null,
      locale: 'it-IT',
      args: opts.hidden
        ? [
            '--window-position=-32000,-32000',
            '--window-size=1366,900',
            // una finestra non visibile altrimenti viene rallentata e il pannello non finisce di caricare
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling',
          ]
        : ['--start-maximized'],
    })
  } catch (err) {
    // Edge rifiuta un secondo avvio sullo stesso profilo
    if (/has been closed|existing browser session|sessione del browser esistente/i.test(String(err))) {
      throw new Error(
        'La finestra di Edge aperta dallo script è ancora aperta (o bloccata in background). Chiudila e riprova; ' +
          'se non la vedi: Get-CimInstance Win32_Process -Filter "name=\'msedge.exe\'" | ' +
          'Where-Object CommandLine -like "*cambiamenti-aruba*" | ForEach-Object { Stop-Process -Id $_.ProcessId }',
      )
    }
    throw err
  }
}

/** Apre la pagina riprovando: il pannello Aruba a volte interrompe il primo caricamento (ERR_ABORTED). */
export async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      return
    } catch (err) {
      if (i >= attempts || !/net::ERR_|Timeout/i.test(String(err)) || page.isClosed()) throw err
      console.log(`Pannello Aruba non caricato (${String(err).match(/net::ERR_\w+|Timeout/)?.[0]}): riprovo...`)
      await page.waitForTimeout(3000 * i)
    }
  }
}

/** Messaggio chiaro quando la finestra di Edge si chiude mentre lo script lavora. */
export function explainBrowserError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  if (/Target page, context or browser has been closed|Browser has been closed/i.test(text)) {
    return (
      'La finestra di Edge dello script si è chiusa mentre lavorava (chiusa a mano o da un altro comando «npm run aruba» ' +
      'partito nello stesso momento). Lancia un comando alla volta e rilancialo.'
    )
  }
  return text
}

async function visiblePassword(page: Page) {
  const field = page.locator('input[type="password"]:visible').first()
  return (await field.count()) > 0 ? field : null
}

/**
 * Porta il browser dentro il pannello Aruba. Se serve il login compila utente e password dal
 * file centrale delle credenziali; l'eventuale OTP lo inserisci tu nella finestra.
 */
export async function ensureLoggedIn(page: Page, timeoutMin = 5): Promise<void> {
  if (page.url() === 'about:blank') await gotoWithRetry(page, panelUrl)
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  let password = await visiblePassword(page)
  if (!password) {
    // Sito vetrina: cerca il link per entrare nell'area riservata
    const enter = page.getByRole('link', { name: /accedi|area riservata|login/i }).first()
    if ((await enter.count()) > 0) {
      await enter.click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      password = await visiblePassword(page)
    }
  }

  if (password) {
    const creds = arubaCredentials()
    if (creds) {
      const form = page.locator('form', { has: password }).first()
      const scope = (await form.count()) > 0 ? form : page
      const user = scope
        .locator('input[type="email"]:visible, input[type="text"]:visible, input:not([type]):visible')
        .first()
      if ((await user.count()) > 0) await user.fill(creds.username)
      await password.fill(creds.password)
      const submit = scope
        .locator('button[type="submit"]:visible, input[type="submit"]:visible')
        .or(scope.getByRole('button', { name: /accedi|entra|login|continua/i }))
        .first()
      if ((await submit.count()) > 0) await submit.click()
      else await password.press('Enter')
      console.log('Credenziali inserite. Se Aruba chiede il codice OTP, inseriscilo nella finestra.')
    } else {
      console.log('Credenziali Aruba non trovate nel file centrale: accedi a mano nella finestra.')
    }
  }

  // Aspetta che il login (e l'eventuale OTP) sia finito: nessun campo password visibile
  const deadline = Date.now() + timeoutMin * 60_000
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000)
    const onLogin = (await visiblePassword(page)) || /login|signin|auth|otp/i.test(new URL(page.url()).pathname)
    if (!onLogin) return
  }
  throw new Error(`Login Aruba non completato entro ${timeoutMin} minuti`)
}
