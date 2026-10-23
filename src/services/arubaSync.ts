import { supabase } from '../lib/supabase'

export interface ArubaSyncRequest {
  id: string
  source: 'manual' | 'auto'
  years: number[]
  status: 'pending' | 'running' | 'done' | 'error'
  message: string
  log: string[]
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface ArubaAgent {
  id: string
  last_seen_at: string
  busy: boolean
}

/** Chiede al servizio sul PC di sincronizzare con Aruba gli anni indicati. */
export async function requestArubaSync(years: number[]): Promise<ArubaSyncRequest> {
  const { data, error } = await supabase
    .from('aruba_sync_requests')
    .insert({ years, source: 'manual', status: 'pending' })
    .select('*')
    .single()
  if (error) throw error
  return data as ArubaSyncRequest
}

export async function listArubaSyncRequests(limit = 5): Promise<ArubaSyncRequest[]> {
  const { data, error } = await supabase
    .from('aruba_sync_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as ArubaSyncRequest[]
}

/** PC con il servizio acceso (l'ultimo che ha dato segnale). */
export async function getArubaAgent(): Promise<ArubaAgent | null> {
  const { data, error } = await supabase
    .from('aruba_agents')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data as ArubaAgent[])[0] ?? null
}

export { agentOnline } from '../lib/arubaSync'
