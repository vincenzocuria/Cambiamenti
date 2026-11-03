-- Registro delle modifiche fatte da Claude tramite il connettore MCP.
-- Ogni strumento di scrittura aggiunge una riga con l'utente che ha collegato il connettore.
-- Solo inserimento e lettura (staff): nessuno può modificare o cancellare il registro.

create table if not exists public.mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  tool text not null check (char_length(tool) between 1 and 80),
  course_id uuid references public.courses (id) on delete set null,
  summary text not null default '' check (char_length(summary) <= 2000),
  args jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mcp_audit_log_created_idx on public.mcp_audit_log (created_at desc);
create index if not exists mcp_audit_log_course_idx on public.mcp_audit_log (course_id);

alter table public.mcp_audit_log enable row level security;

create policy "mcp_audit_log_read" on public.mcp_audit_log for select to authenticated
  using ((select app.is_staff()));

create policy "mcp_audit_log_insert" on public.mcp_audit_log for insert to authenticated
  with check ((select app.is_staff()) and user_id = (select auth.uid()));
