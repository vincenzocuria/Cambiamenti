/**
 * Lettura del registro eventi di Moodle con l'utente amministratore (sola lettura).
 * Il token dei web service non dà accesso ai log: si scarica il report «Log» in CSV.
 */

export interface MoodleCourseOption {
  id: number
  name: string
}

export class MoodleWebSession {
  private cookies = new Map<string, string>()
  private base: string

  constructor(base: string, private user: string, private password: string) {
    this.base = base.replace(/\/$/, '')
  }

  static fromEnv(): MoodleWebSession {
    const base = Deno.env.get('MOODLE_URL')
    const user = Deno.env.get('MOODLE_ADMIN_USER')
    const password = Deno.env.get('MOODLE_ADMIN_PASSWORD')
    if (!base) throw new Error('MOODLE_URL mancante')
    if (!user || !password) throw new Error('Credenziali amministratore Moodle mancanti (MOODLE_ADMIN_USER/PASSWORD)')
    return new MoodleWebSession(base, user, password)
  }

  private cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  private keep(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
  }

  private async get(url: string): Promise<{ url: string; text: string; type: string }> {
    for (let n = 0; n < 8; n++) {
      const res = await fetch(url, { headers: { cookie: this.cookieHeader() }, redirect: 'manual' })
      this.keep(res)
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel()
        url = new URL(res.headers.get('location') ?? '/', url).href
        continue
      }
      return { url, text: await res.text(), type: res.headers.get('content-type') ?? '' }
    }
    throw new Error('Troppi reindirizzamenti da Moodle')
  }

  private async login() {
    const page = await this.get(`${this.base}/login/index.php`)
    const token = page.text.match(/name="logintoken" value="([^"]+)"/)?.[1] ?? ''
    const body = new URLSearchParams({ username: this.user, password: this.password, logintoken: token, anchor: '' })
    const res = await fetch(`${this.base}/login/index.php`, {
      method: 'POST',
      body,
      headers: { cookie: this.cookieHeader() },
      redirect: 'manual',
    })
    this.keep(res)
    await res.body?.cancel()
  }

  /** Pagina di Moodle da autenticati: se serve fa il login. */
  async page(path: string): Promise<{ text: string; type: string }> {
    let res = await this.get(`${this.base}/${path}`)
    if (/\/login\/index\.php/.test(res.url)) {
      await this.login()
      res = await this.get(`${this.base}/${path}`)
      if (/\/login\/index\.php/.test(res.url)) throw new Error('Accesso a Moodle non riuscito')
    }
    return res
  }

  /** Report log completo di un corso, in CSV. */
  async courseLogCsv(moodleCourseId: number): Promise<string> {
    const params = new URLSearchParams({
      chooselog: '1',
      showusers: '0',
      showcourses: '0',
      id: String(moodleCourseId),
      user: '0',
      date: '0',
      modid: '',
      modaction: '',
      origin: '',
      edulevel: '-1',
      logreader: 'logstore_standard',
      download: 'csv',
    })
    const res = await this.page(`report/log/index.php?${params}`)
    if (!/csv|text\/plain|octet-stream/i.test(res.type)) throw new Error('Moodle non ha restituito il log in CSV')
    return res.text
  }

  /** Corsi visibili nell'elenco corsi di Moodle. */
  async listCourses(): Promise<MoodleCourseOption[]> {
    const res = await this.page('course/index.php?perpage=all')
    const found = new Map<number, string>()
    const re = /course\/view\.php\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/g
    for (const m of res.text.matchAll(re)) {
      const id = Number(m[1])
      const name = decodeEntities(m[2].replace(/<[^>]+>/g, '')).trim()
      if (id > 1 && name && !found.has(id)) found.set(id, name)
    }
    return [...found].map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id)
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}
