-- Proposte (dalle PEC o da altre fonti): nessuna modifica ai dati finché una persona
-- non le accetta dalla pagina «Proposte». L'applicazione avviene con l'utente che accetta.

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('crea_corso', 'aggiorna_corso', 'cambia_stato_corso', 'aggiungi_nota_corso', 'registra_pagamento', 'allega_documento', 'aggiungi_lezione')),
  course_id uuid references public.courses (id) on delete cascade,
  pec_message_id uuid references public.pec_messages (id) on delete set null,
  -- titolo breve e chiaro, es. «Eipass Progressive ED3: inserire CUP J34D26003310006»
  title text not null check (char_length(title) between 3 and 300),
  -- perché: cosa dice la fonte (protocollo, data, riga del decreto...)
  reason text not null default '' check (char_length(reason) <= 4000),
  -- dati da applicare (forma diversa per ogni tipo, vedi src/lib/proposals.ts)
  payload jsonb not null default '{}'::jsonb,
  -- valori attuali al momento della proposta, per il confronto «ora → proposto»
  current_values jsonb not null default '{}'::jsonb,
  status text not null default 'proposta' check (status in ('proposta', 'applicata', 'rifiutata', 'errore')),
  result text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz
);
create index if not exists proposals_status_idx on public.proposals (status, created_at desc);
create index if not exists proposals_course_idx on public.proposals (course_id);
create index if not exists proposals_pec_idx on public.proposals (pec_message_id);

alter table public.proposals enable row level security;

create policy "proposals_read" on public.proposals for select to authenticated
  using ((select app.is_staff()));
create policy "proposals_insert" on public.proposals for insert to authenticated
  with check ((select app.is_staff()) and status = 'proposta');
create policy "proposals_update" on public.proposals for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
