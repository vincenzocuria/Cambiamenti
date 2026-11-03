-- Archivio delle PEC di Cambia-Menti, letto in sola lettura dal servizio sul PC (npm run pec).
-- Claude le elabora tramite il connettore MCP (aggiorna i corsi e segna l'esito);
-- la pagina «Posta da verificare» mostra cosa è stato fatto e cosa va controllato.

create table if not exists public.pec_messages (
  id uuid primary key default gen_random_uuid(),
  mailbox text not null,
  folder text not null,
  uid bigint not null,
  message_id text,
  direction text not null check (direction in ('in', 'out')),
  from_address text not null default '',
  to_addresses text not null default '',
  subject text not null default '',
  sent_at timestamptz,
  body_text text not null default '',
  -- nuova = da elaborare; elaborata = Claude ha aggiornato il gestionale; da_verificare = serve
  -- una persona; ignorata = ricevute PEC, pubblicità...; verificata = controllata da una persona
  status text not null default 'nuova' check (status in ('nuova', 'elaborata', 'da_verificare', 'ignorata', 'verificata')),
  claude_note text not null default '',
  course_ids uuid[] not null default '{}',
  processed_at timestamptz,
  processed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (mailbox, folder, uid)
);
create index if not exists pec_messages_status_idx on public.pec_messages (status, sent_at desc);
create index if not exists pec_messages_sent_idx on public.pec_messages (sent_at desc);

create table if not exists public.pec_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.pec_messages (id) on delete cascade,
  file_name text not null,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  -- percorso nel bucket documents (null se il tipo di file non è ammesso)
  storage_path text,
  -- testo estratto dal PDF (anche dentro .p7m), per farlo leggere a Claude
  text_content text not null default '',
  document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pec_attachments_message_idx on public.pec_attachments (message_id);

alter table public.pec_messages enable row level security;
alter table public.pec_attachments enable row level security;

-- Il servizio sul PC scrive con la chiave service_role; lo staff legge e aggiorna l'esito.
create policy "pec_messages_read" on public.pec_messages for select to authenticated
  using ((select app.is_staff()));
create policy "pec_messages_update" on public.pec_messages for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy "pec_attachments_read" on public.pec_attachments for select to authenticated
  using ((select app.is_staff()));
create policy "pec_attachments_update" on public.pec_attachments for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
