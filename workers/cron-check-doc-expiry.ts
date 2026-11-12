interface Env {
  CRON_SECRET: string
  CHECK_DOC_EXPIRY_URL?: string
  SYNC_FAD_ATTENDANCE_URL?: string
}

const FUNCTIONS_BASE = 'https://oevppwtjbzbopjvsvoiu.supabase.co/functions/v1'

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      Promise.allSettled([
        call('check-doc-expiry', env.CHECK_DOC_EXPIRY_URL ?? `${FUNCTIONS_BASE}/check-doc-expiry`, env),
        // Presenze FAD: rilegge i log Moodle dei corsi collegati
        call(
          'sync-fad-attendance',
          env.SYNC_FAD_ATTENDANCE_URL ?? `${FUNCTIONS_BASE}/sync-fad-attendance`,
          env,
        ),
      ]).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length) throw new Error(`${failed.length} job cron falliti`)
      }),
    )
  },
}

async function call(name: string, url: string, env: Env): Promise<void> {
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
    console.error(`${name} failed`, res.status, text)
    throw new Error(`${name} ${res.status}`)
  }
  console.log(`${name} ok`, text)
}
