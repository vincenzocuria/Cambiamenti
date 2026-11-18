-- Iter amministrativo del corso: i passi dal decreto alla chiusura (modello GOL o standard),
-- ognuno con stato, scadenza, data in cui è fatto, note e i documenti che lo provano.
-- I passi nascono dal modello in src/lib/courseIter.ts (step_key); quelli aggiunti a mano non hanno chiave.

create table if not exists public.course_steps (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  step_key text check (step_key is null or char_length(step_key) between 1 and 60),
  sort_order integer not null default 0,
  title text not null check (char_length(title) between 1 and 300),
  status text not null default 'da_fare' check (status in ('da_fare', 'in_corso', 'fatto', 'non_applicabile')),
  due_on date,
  done_on date,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists course_steps_key_idx on public.course_steps (course_id, step_key) where step_key is not null;
create index if not exists course_steps_course_idx on public.course_steps (course_id, sort_order);
create index if not exists course_steps_due_idx on public.course_steps (due_on) where status in ('da_fare', 'in_corso');

alter table public.course_steps enable row level security;
create policy "course_steps_staff" on public.course_steps for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

create trigger course_steps_updated_at
  before update on public.course_steps
  for each row execute function app.set_updated_at();

-- Documenti che provano un passo (restano anche tra i documenti del corso)
create table if not exists public.course_step_documents (
  step_id uuid not null references public.course_steps (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (step_id, document_id)
);
create index if not exists course_step_documents_doc_idx on public.course_step_documents (document_id);

alter table public.course_step_documents enable row level security;
create policy "course_step_documents_staff" on public.course_step_documents for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
