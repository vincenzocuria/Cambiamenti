import { createClient } from '@supabase/supabase-js'
import { dbQuery } from './dbQuery.mjs'
import { sqlLiteral } from './sqlLiteral.mjs'
import { getSupabaseAccessToken } from '../lib/supabaseAccessToken.mjs'

const OLD_REF = process.env.SPLIT_OLD_REF || 'nmmjivrsuezhptwsfqdv'
const NEW_REF = process.env.SPLIT_CM_REF || 'oevppwtjbzbopjvsvoiu'

const PUBLIC_TABLES = [
  'profiles',
  'courses',
  'students',
  'people',
  'course_students',
  'course_staff',
  'document_templates',
  'documents',
  'notifications',
]

async function getServiceKey(projectRef) {
  const token = getSupabaseAccessToken()
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`api-keys ${projectRef}: ${res.status}`)
  const keys = await res.json()
  const row = (Array.isArray(keys) ? keys : []).find((k) => k.name === 'service_role')
  const key = row?.api_key || row?.key
  if (!key) throw new Error(`service_role mancante su ${projectRef}`)
  return key
}

async function copyAuth() {
  console.log('Auth: preparo destinazione...')
  await dbQuery(NEW_REF, 'drop trigger if exists on_auth_user_created on auth.users;')
  await dbQuery(NEW_REF, 'delete from public.profiles;')

  const users = await dbQuery(
    OLD_REF,
    `select * from auth.users order by created_at`,
  )
  if (!users?.length) {
    console.log('Auth: nessun utente da copiare')
    return
  }

  const userCols = Object.keys(users[0]).filter((c) => c !== 'confirmed_at')
  for (const batch of chunk(users, 20)) {
    const values = batch
      .map((row) => {
        const vals = userCols.map((c) => {
          const v = row[c]
          if (c === 'raw_user_meta_data' || c === 'raw_app_meta_data') {
            return sqlLiteral(v, 'jsonb')
          }
          if (c.includes('_at') || c === 'email_confirmed_at') {
            return sqlLiteral(v, 'timestamptz')
          }
          if (c === 'id') return sqlLiteral(v, 'uuid')
          return sqlLiteral(v, 'text')
        })
        return `(${vals.join(',')})`
      })
      .join(',\n')
    const sql = `insert into auth.users (${userCols.join(',')}) values ${values} on conflict (id) do nothing`
    await dbQuery(NEW_REF, sql)
  }

  const identities = await dbQuery(OLD_REF, `select * from auth.identities`)
  if (identities?.length) {
    const idCols = Object.keys(identities[0]).filter((c) => c !== 'email')
    for (const batch of chunk(identities, 50)) {
      const values = batch
        .map((row) => {
          const vals = idCols.map((c) => {
            const v = row[c]
            if (c === 'identity_data' || c === 'provider_id') {
              return c === 'identity_data' ? sqlLiteral(v, 'jsonb') : sqlLiteral(v, 'text')
            }
            if (c === 'id' || c === 'user_id') return sqlLiteral(v, 'uuid')
            if (c.includes('_at')) return sqlLiteral(v, 'timestamptz')
            return sqlLiteral(v, 'text')
          })
          return `(${vals.join(',')})`
        })
        .join(',\n')
      const sql = `insert into auth.identities (${idCols.join(',')}) values ${values} on conflict (id) do nothing`
      await dbQuery(NEW_REF, sql)
    }
  }

  console.log(`Auth: copiati ${users.length} utenti`)
}

async function copyPublicTables() {
  for (const table of PUBLIC_TABLES) {
    const rows = await dbQuery(OLD_REF, `select * from public.${table}`)
    if (!rows?.length) {
      console.log(`public.${table}: vuota, skip`)
      continue
    }
    const cols = Object.keys(rows[0])
    for (const batch of chunk(rows, 40)) {
      const values = batch
        .map((row) => {
          const vals = cols.map((c) => {
            const v = row[c]
            if (v === null || v === undefined) return 'NULL'
            if (typeof v === 'number') return String(v)
            if (typeof v === 'boolean') return v ? 'true' : 'false'
            if (c.includes('_at') || c.endsWith('_date')) return sqlLiteral(v, 'timestamptz')
            if (c === 'id' || c.endsWith('_id')) return sqlLiteral(v, 'uuid')
            return sqlLiteral(v, 'text')
          })
          return `(${vals.join(',')})`
        })
        .join(',\n')
      const sql = `insert into public.${table} (${cols.join(',')}) values ${values} on conflict do nothing`
      await dbQuery(NEW_REF, sql)
    }
    console.log(`public.${table}: ${rows.length} righe`)
  }
}

async function copyStorage() {
  console.log('Storage: copia bucket documents...')
  const oldKey = await getServiceKey(OLD_REF)
  const newKey = await getServiceKey(NEW_REF)
  const oldUrl = `https://${OLD_REF}.supabase.co`
  const newUrl = `https://${NEW_REF}.supabase.co`
  const oldSb = createClient(oldUrl, oldKey, { auth: { persistSession: false } })
  const newSb = createClient(newUrl, newKey, { auth: { persistSession: false } })

  const { data: objects, error: listErr } = await oldSb.storage.from('documents').list('', {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (listErr) throw listErr

  const paths = []
  async function walk(prefix) {
    const { data, error } = await oldSb.storage.from('documents').list(prefix, {
      limit: 1000,
    })
    if (error) throw error
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) paths.push(path)
      else await walk(path)
    }
  }
  await walk('')

  const docs = await dbQuery(OLD_REF, `select storage_path from public.documents`)
  const fromDb = new Set((docs ?? []).map((d) => d.storage_path))
  const allPaths = [...new Set([...paths, ...fromDb])].filter(Boolean)

  let ok = 0
  for (const path of allPaths) {
    const { data: blob, error: dlErr } = await oldSb.storage.from('documents').download(path)
    if (dlErr) {
      console.warn('Storage skip', path, dlErr.message)
      continue
    }
    const { error: upErr } = await newSb.storage.from('documents').upload(path, blob, {
      upsert: true,
      contentType: blob.type || undefined,
    })
    if (upErr) {
      console.warn('Storage upload fail', path, upErr.message)
      continue
    }
    ok++
  }
  console.log(`Storage: ${ok}/${allPaths.length} file copiati`)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function migrateCambiamenti() {
  await copyAuth()
  await copyPublicTables()
  await copyStorage()
  await dbQuery(
    NEW_REF,
    `create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function app.handle_new_user();`,
  )
  console.log('Cambia-Menti: migrazione dati completata')
}

import { pathToFileURL } from 'node:url'
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  migrateCambiamenti().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
