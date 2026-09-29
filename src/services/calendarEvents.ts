import { supabase } from '../lib/supabase'
import type { CalendarEvent, CalendarEventInput } from '../types/db'

export async function getCalendarEventByUid(external_uid: string): Promise<CalendarEvent | null> {
  if (!external_uid) return null
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('external_uid', external_uid)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  const { data, error } = await supabase.from('calendar_events').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateCalendarEvent(
  id: string,
  input: Partial<CalendarEventInput>,
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export type CalendarEventUpsertResult = 'created' | 'updated'

export async function upsertCalendarEventByUid(
  input: CalendarEventInput,
): Promise<CalendarEventUpsertResult> {
  const uid = input.external_uid.trim()
  if (!uid) {
    await createCalendarEvent(input)
    return 'created'
  }

  const existing = await getCalendarEventByUid(uid)
  if (!existing) {
    await createCalendarEvent(input)
    return 'created'
  }

  await updateCalendarEvent(existing.id, input)
  return 'updated'
}
