import { supabase } from './supabase'
import type { NotificationType } from './notificationTypes'

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
}

/** Inserisce una notifica per un utente (richiede sessione staff). */
export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const { data, error } = await supabase.rpc('insert_notification', {
    p_user_id: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_body: input.body ?? '',
    p_link: input.link ?? '',
  })
  if (error) throw error
  return data as string
}
