import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dbQuery } from './dbQuery.mjs'
import { sqlLiteral } from './sqlLiteral.mjs'

const OLD_REF = process.env.SPLIT_OLD_REF || 'nmmjivrsuezhptwsfqdv'
const NEW_REF = process.env.SPLIT_LG_REF || 'mtgjjldcljzyyythuyho'

const LG_TABLES = [
  'roles',
  'permissions',
  'users',
  'user_roles',
  'role_permissions',
  'refresh_tokens',
  'password_reset_tokens',
  'audit_logs',
  'customers',
  'products',
  'quote_pricing_settings',
  'quotes',
  'jobs',
  'job_assignments',
  'push_devices',
  'cnc_cost_settings',
  'stock_movements',
  'utility_bills',
  'delivery_notes',
  'delivery_note_lines',
  'document_series',
  'document_counters',
  'invoices',
  'invoice_lines',
  'invoice_ddt_links',
  'company_cost_settings',
  'company_cost_lines',
  'notifications',
]

async function exportTableDdl(table) {
  const rows = await dbQuery(
    OLD_REF,
    `
    select
      'create table if not exists public.${table} (' ||
      string_agg(
        quote_ident(a.attname) || ' ' ||
        pg_catalog.format_type(a.atttypid, a.atttypmod) ||
        case when a.attnotnull then ' not null' else '' end ||
        case
          when ad.adbin is not null and a.attgenerated = '' then
            ' default ' || pg_get_expr(ad.adbin, ad.adrelid)
          else ''
        end,
        ', '
        order by a.attnum
      ) || ');' as ddl
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
    where n.nspname = 'public'
      and c.relname = '${table}'
      and a.attnum > 0
      and not a.attisdropped
    group by c.relname;
    `,
  )
  const ddl = rows?.[0]?.ddl
  if (!ddl) throw new Error(`DDL mancante per ${table}`)
  return ddl
}

async function exportPrimaryKeys(table) {
  const rows = await dbQuery(
    OLD_REF,
    `
    select pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = '${table}' and c.contype = 'p';
    `,
  )
  if (!rows?.[0]?.def) return null
  return `alter table public.${table} add constraint ${table}_pkey ${rows[0].def};`
}

async function exportForeignKeys(table) {
  const rows = await dbQuery(
    OLD_REF,
    `
    select pg_get_constraintdef(c.oid) as def, c.conname as name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = '${table}' and c.contype = 'f';
    `,
  )
  return (rows ?? []).map(
    (r) => `alter table public.${table} add constraint ${r.name} ${r.def};`,
  )
}

async function copySequences() {
  const seqs = await dbQuery(
    OLD_REF,
    `
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
    order by 1;
    `,
  )
  for (const { name } of seqs ?? []) {
    await dbQuery(NEW_REF, `create sequence if not exists public."${name}";`)
  }
  console.log(`  sequenze: ${seqs?.length ?? 0}`)
}

async function ensureLgSchema() {
  console.log('LG Edil: creo schema su progetto nuovo...')
  await dbQuery(NEW_REF, 'create extension if not exists "uuid-ossp";')
  await dbQuery(NEW_REF, 'create extension if not exists pgcrypto;')
  await copySequences()

  for (const table of LG_TABLES) {
    const exists = await dbQuery(
      NEW_REF,
      `select to_regclass('public.${table}') as reg;`,
    )
    if (exists?.[0]?.reg) {
      console.log(`  ${table}: già presente`)
      continue
    }
    const ddl = await exportTableDdl(table)
    await dbQuery(NEW_REF, ddl)
    const pk = await exportPrimaryKeys(table)
    if (pk) {
      try {
        await dbQuery(NEW_REF, pk)
      } catch {
        /* pk già inclusa o duplicata */
      }
    }
    console.log(`  ${table}: create`)
  }

  for (const table of LG_TABLES) {
    const fks = await exportForeignKeys(table)
    for (const fk of fks) {
      try {
        await dbQuery(NEW_REF, fk)
      } catch (e) {
        const msg = String(e.message || e)
        if (!msg.includes('already exists')) console.warn('FK skip', table, msg.slice(0, 120))
      }
    }
  }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function copyLgData() {
  console.log('LG Edil: copia dati...')
  for (const table of LG_TABLES.filter((t) => t !== 'notifications')) {
    await dbQuery(NEW_REF, `truncate table public.${table} cascade;`).catch(() => {})
    const rows = await dbQuery(OLD_REF, `select * from public.${table}`)
    if (!rows?.length) {
      console.log(`  ${table}: vuota`)
      continue
    }
    const cols = Object.keys(rows[0])
    for (const batch of chunk(rows, 30)) {
      const values = batch
        .map((row) => {
          const vals = cols.map((c) => {
            const v = row[c]
            if (v === null || v === undefined) return 'NULL'
            if (typeof v === 'number') return String(v)
            if (typeof v === 'boolean') return v ? 'true' : 'false'
            if (typeof v === 'object') return sqlLiteral(v, 'jsonb')
            if (c.includes('_at') || c.endsWith('_date')) return sqlLiteral(v, 'timestamptz')
            if (c === 'id' || c.endsWith('_id')) return sqlLiteral(v, 'uuid')
            return sqlLiteral(v, 'text')
          })
          return `(${vals.join(',')})`
        })
        .join(',\n')
      const sql = `insert into public.${table} (${cols.join(',')}) values ${values}`
      await dbQuery(NEW_REF, sql)
    }
    console.log(`  ${table}: ${rows.length} righe`)
  }

  const seqs = await dbQuery(
    OLD_REF,
    `
    select c.relname as name, s.last_value
    from pg_sequences s
    join pg_class c on c.relname = s.sequencename
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public';
    `,
  )
  for (const { name, last_value } of seqs ?? []) {
    if (last_value == null) continue
    await dbQuery(
      NEW_REF,
      `select setval('public."${name}"', ${Number(last_value)}, true);`,
    )
  }
}

/** notifications su vcuria-gestionale è schema Cambia-Menti: su lg-edil ricreiamo la forma LG. */
async function fixLgNotificationsTable() {
  await dbQuery(NEW_REF, 'drop table if exists public.notifications cascade;')
  await dbQuery(
    NEW_REF,
    `
    create table public.notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id) on delete cascade,
      type varchar(50) not null,
      title varchar(255) not null,
      body text not null,
      entity_type varchar(50),
      entity_id varchar(100),
      payload jsonb,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index if not exists notifications_user_id_idx on public.notifications (user_id);
    create index if not exists notifications_type_idx on public.notifications (type);
    `,
  )
  console.log('  notifications: schema LG Edil (vuota)')
}

export async function migrateLgEdil() {
  await ensureLgSchema()
  await fixLgNotificationsTable()
  const tablesNoNotif = LG_TABLES.filter((t) => t !== 'notifications')
  for (const table of tablesNoNotif) {
    const rows = await dbQuery(OLD_REF, `select count(*)::int as n from public.${table}`)
    console.log(`  check ${table}: ${rows?.[0]?.n ?? 0}`)
  }
  await copyLgData()
  console.log('LG Edil: migrazione completata')
}

import { pathToFileURL } from 'node:url'
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  migrateLgEdil().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
