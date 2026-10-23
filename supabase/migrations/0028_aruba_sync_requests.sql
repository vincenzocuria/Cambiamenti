-- Sincronizzazione con Aruba dal gestionale: il tasto crea una richiesta, il servizio sul PC
-- (npm run aruba -- servizio) la esegue e scrive l'esito. Il PC segnala anche che è acceso.

create table if not exists public.aruba_sync_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users (id) on delete set null default auth.uid(),
  -- manual = tasto nel gestionale, auto = sincronizzazione periodica del servizio
  source text not null default 'manual' check (source in ('manual', 'auto')),
  years integer[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  message text not null default '',
  log text[] not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists aruba_sync_requests_created_idx on public.aruba_sync_requests (created_at desc);

alter table public.aruba_sync_requests enable row level security;

create policy "aruba_sync_requests_read" on public.aruba_sync_requests for select to authenticated
  using ((select app.is_staff()));

create policy "aruba_sync_requests_insert" on public.aruba_sync_requests for insert to authenticated
  with check ((select app.is_staff()) and status = 'pending' and source = 'manual');

-- Ultimo segnale del servizio sul PC (una riga per PC)
create table if not exists public.aruba_agents (
  id text primary key,
  last_seen_at timestamptz not null default now(),
  busy boolean not null default false
);

alter table public.aruba_agents enable row level security;

create policy "aruba_agents_read" on public.aruba_agents for select to authenticated
  using ((select app.is_staff()));
