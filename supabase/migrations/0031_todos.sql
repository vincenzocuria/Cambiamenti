-- «Cose da fare»: checklist generale dello staff (non legata a un corso).
-- Spuntata, la voce sparisce dall'elenco ma resta nello storico (done_at) e si può rimettere da fare.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(btrim(text)) > 0),
  due_on date,
  created_at timestamptz not null default now(),
  created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
  done_at timestamptz,
  done_by_email text
);

create index if not exists todos_open_idx on public.todos (created_at) where done_at is null;

create index if not exists todos_done_idx on public.todos (done_at desc) where done_at is not null;

alter table public.todos enable row level security;

create policy "todos_all" on public.todos for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
