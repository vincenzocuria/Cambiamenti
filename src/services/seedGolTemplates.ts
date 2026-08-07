import { golTemplateSeeds } from '../data/golTemplates'
import { supabase } from '../lib/supabase'

/** Promise condivisa: evita insert doppi con React Strict Mode / chiamate parallele. */
let seedPromise: Promise<void> | null = null

/** Inserisce i template GOL mancanti (una sola volta, anche con chiamate concorrenti). */
export async function ensureGolTemplates(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedGolTemplates().catch((err) => {
      seedPromise = null
      throw err
    })
  }
  await seedPromise
}

async function seedGolTemplates(): Promise<void> {
  await removeDuplicateTemplatesByName()

  const { data, error } = await supabase.from('document_templates').select('name')
  if (error) throw error

  const existing = new Set((data ?? []).map((r) => r.name))
  const missing = golTemplateSeeds.filter((t) => !existing.has(t.name))
  if (missing.length === 0) return

  const { error: insertError } = await supabase.from('document_templates').insert(missing)
  // 23505 = unique_violation (race residua o ricarica HMR)
  if (insertError && insertError.code !== '23505') throw insertError
}

/** Tiene il template più vecchio per ogni nome e cancella i duplicati. */
async function removeDuplicateTemplatesByName(): Promise<void> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error

  const keep = new Set<string>()
  const toDelete: string[] = []

  for (const row of data ?? []) {
    if (keep.has(row.name)) {
      toDelete.push(row.id)
    } else {
      keep.add(row.name)
    }
  }

  if (toDelete.length === 0) return

  const { error: deleteError } = await supabase
    .from('document_templates')
    .delete()
    .in('id', toDelete)
  if (deleteError) throw deleteError
}
