import type { McpServer } from '@modelcontextprotocol/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { McpAuth } from '../auth/session'

export type McpCtx = {
  server: McpServer
  db: SupabaseClient
  auth: McpAuth
}

export function text(value: unknown) {
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text' as const, text: body }] }
}

/** Testo libero sicuro dentro un filtro PostgREST or()/ilike. */
export function searchTerm(value: string): string {
  return value.replace(/[,()*%\\:"]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Relazione PostgREST che può arrivare come oggetto o array. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Filtro or() di PostgREST: ogni parola deve comparire in almeno una colonna
 * (es. "673.7 ED2" trova ID corso 673.7 con edizione ED2).
 */
export function wordsFilter(value: string, columns: string[]): string | null {
  const words = searchTerm(value).split(' ').filter(Boolean).slice(0, 6)
  if (words.length === 0) return null
  const group = (w: string) => columns.map((c) => `${c}.ilike.*${w}*`).join(',')
  if (words.length === 1) return group(words[0])
  return `and(${words.map((w) => `or(${group(w)})`).join(',')})`
}
