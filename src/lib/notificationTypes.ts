/** Tipi di notifica in-app. */
export const notificationTypes = [
  'user_pending',
  'user_approved',
  'role_changed',
  'course_to_report',
  'doc_expiry',
] as const

export type NotificationType = (typeof notificationTypes)[number]

/** Tipi che generano anche email agli admin. */
export const emailNotificationTypes: NotificationType[] = [
  'user_pending',
  'course_to_report',
  'doc_expiry',
]

export function isEmailNotificationType(type: string): type is NotificationType {
  return (emailNotificationTypes as readonly string[]).includes(type)
}
