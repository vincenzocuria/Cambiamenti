import { supabase } from '../lib/supabase'

export type ResetUserPasswordMode = 'email' | 'direct'

export async function resetUserPassword(input: {
  userId: string
  mode: ResetUserPasswordMode
  password?: string
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'reset-user-password',
    {
      body: {
        userId: input.userId,
        mode: input.mode,
        password: input.password,
        redirectTo: `${window.location.origin}/reimposta-password`,
      },
    },
  )
  if (data?.error) throw new Error(data.error)
  if (error) throw new Error(error.message || 'Reset password non riuscito')
}
