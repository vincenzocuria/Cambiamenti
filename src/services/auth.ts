import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/roles'
import { titleCase } from '../lib/text'
import type { Profile } from '../types/db'
import { sendNotificationEmail } from './sendNotificationEmail'

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  })
  if (error) throw error
}

export async function signUp(email: string, password: string, fullName: string) {
  const normalized = normalizeEmail(email)
  const displayName = titleCase(fullName)
  const { error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: { data: { full_name: displayName } },
  })
  if (error) throw error

  try {
    await sendNotificationEmail({
      type: 'user_pending',
      title: 'Nuovo utente in attesa',
      body: `${displayName} (${normalized}) richiede approvazione.`,
      link: '/utenti',
      pendingEmail: normalized,
    })
  } catch {
    /* email opzionale: notifica in-app già creata dal trigger DB */
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const redirectTo = `${window.location.origin}/reimposta-password`
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo,
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
