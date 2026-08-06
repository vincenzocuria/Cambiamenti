import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Variabili VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY mancanti')
}

export const supabase = createClient(url, key)
