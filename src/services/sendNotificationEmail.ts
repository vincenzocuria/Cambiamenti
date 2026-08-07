import { supabase } from '../lib/supabase'
import type { NotificationType } from '../lib/notificationTypes'

export interface SendNotificationEmailInput {
  type: NotificationType
  title: string
  body: string
  link?: string
  /** Solo per user_pending da signup pubblico. */
  pendingEmail?: string
}

export async function sendNotificationEmail(input: SendNotificationEmailInput): Promise<void> {
  const { error } = await supabase.functions.invoke('send-notification-email', {
    body: input,
  })
  if (error) throw error
}
