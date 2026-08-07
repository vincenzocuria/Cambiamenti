import { supabase } from '../lib/supabase'

/** Controlla documenti in scadenza (admin o cron con CRON_SECRET). */
export async function checkDocExpiry(): Promise<{ count: number }> {
  const { data, error } = await supabase.functions.invoke('check-doc-expiry', { body: {} })
  if (error) throw error
  return data as { count: number }
}
