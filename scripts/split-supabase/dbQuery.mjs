import { getSupabaseAccessToken } from '../lib/supabaseAccessToken.mjs'

export async function dbQuery(projectRef, query) {
  const token = getSupabaseAccessToken()
  if (!token) throw new Error('Token Supabase non trovato')
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new Error(
      `Query failed on ${projectRef} (${res.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`,
    )
  }
  return data
}
