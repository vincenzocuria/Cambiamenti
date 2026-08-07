import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/roles'
import { titleCase } from '../lib/text'
import type { Role } from '../types/db'

export type InviteRole = Extract<Role, 'staff' | 'admin'>

export async function inviteUser(input: {
  email: string
  fullName: string
  role: InviteRole
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('invite-user', {
    body: {
      email: normalizeEmail(input.email),
      fullName: titleCase(input.fullName),
      role: input.role,
      redirectTo: `${window.location.origin}/reimposta-password`,
    },
  })

  if (data?.error) throw new Error(data.error)
  if (error) throw new Error(error.message || 'Invito non riuscito')
}
