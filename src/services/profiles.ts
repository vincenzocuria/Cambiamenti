import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../types/db'

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function setRole(id: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}
