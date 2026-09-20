interface Env {
  CRON_SECRET: string
  CHECK_DOC_EXPIRY_URL?: string
}

const DEFAULT_URL =
  'https://nmmjivrsuezhptwsfqdv.supabase.co/functions/v1/check-doc-expiry'

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCheck(env))
  },
}

async function runCheck(env: Env): Promise<void> {
  const url = env.CHECK_DOC_EXPIRY_URL ?? DEFAULT_URL
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': env.CRON_SECRET,
    },
    body: '{}',
  })

  const text = await res.text()
  if (!res.ok) {
    console.error('check-doc-expiry failed', res.status, text)
    throw new Error(`check-doc-expiry ${res.status}`)
  }
  console.log('check-doc-expiry ok', text)
}
