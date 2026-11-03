// Limite tentativi (login, registrazione client) salvato in D1.

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

export async function tooManyAttempts(db: D1Database, key: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM auth_attempts WHERE key = ? AND created_at > ?')
    .bind(key, since)
    .first<{ n: number }>()
  return (row?.n ?? 0) >= MAX_ATTEMPTS
}

export async function recordAttempt(db: D1Database, key: string): Promise<void> {
  const now = new Date()
  await db.prepare('INSERT INTO auth_attempts (key, created_at) VALUES (?, ?)').bind(key, now.toISOString()).run()
  if (Math.random() < 0.05) {
    await db.prepare('DELETE FROM auth_attempts WHERE created_at < ?').bind(new Date(now.getTime() - WINDOW_MS).toISOString()).run()
  }
}
