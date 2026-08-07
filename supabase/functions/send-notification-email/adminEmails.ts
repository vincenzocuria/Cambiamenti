import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export async function fetchAdminEmails(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('email')
    .in('role', ['superadmin', 'admin'])
  if (error) throw error
  return (data ?? [])
    .map((r) => r.email?.trim().toLowerCase())
    .filter((e): e is string => Boolean(e))
}

export async function verifyRecentPending(
  admin: SupabaseClient,
  email: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('role', 'pending')
    .gte('created_at', since)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}
