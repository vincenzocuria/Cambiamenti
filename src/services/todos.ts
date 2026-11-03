import { supabase } from '../lib/supabase'
import type { Todo } from '../lib/todos'

const cols = 'id, text, due_on, urgent, created_at, created_by_email, done_at, done_by_email'

/** Voci ancora da fare. */
export async function fetchOpenTodos(): Promise<Todo[]> {
  const { data, error } = await supabase.from('todos').select(cols).is('done_at', null).order('created_at')
  if (error) throw error
  return (data ?? []) as Todo[]
}

/** Voci fatte negli ultimi giorni (le più recenti prima). */
export async function fetchDoneTodos(days = 90): Promise<Todo[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('todos')
    .select(cols)
    .not('done_at', 'is', null)
    .gte('done_at', since)
    .order('done_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as Todo[]
}

export async function addTodo(text: string, dueOn: string | null, urgent = false): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .insert({ text: text.trim(), due_on: dueOn || null, urgent })
    .select(cols)
    .single()
  if (error) throw error
  return data as Todo
}

export async function updateTodo(id: string, patch: { text?: string; due_on?: string | null; urgent?: boolean }): Promise<void> {
  const { error } = await supabase.from('todos').update(patch).eq('id', id)
  if (error) throw error
}

/** Segna come fatta (sparisce dall'elenco) o la rimette da fare. */
export async function setTodoDone(id: string, done: boolean, email: string | null): Promise<void> {
  const patch = done ? { done_at: new Date().toISOString(), done_by_email: email ?? '' } : { done_at: null, done_by_email: null }
  const { error } = await supabase.from('todos').update(patch).eq('id', id)
  if (error) throw error
}

/** Elimina una voce scritta per sbaglio. */
export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) throw error
}
