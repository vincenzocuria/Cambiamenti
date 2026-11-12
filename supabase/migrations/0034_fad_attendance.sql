-- Presenze FAD lette dal registro eventi di Moodle (BigBlueButton), per corso, giornata e alunno.
-- I dati calcolati si possono correggere a mano: le righe con manual = true non vengono più ricalcolate.

-- Eventi originali del registro Moodle (accesso, uscita, chiusura forzata dell'aula)
create table if not exists public.fad_log_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  event_key text not null,
  occurred_at timestamptz not null,
  kind text not null check (kind in ('join', 'leave', 'end')),
  moodle_user_id bigint,
  user_name text not null default '',
  description text not null default '',
  ip text not null default '',
  created_at timestamptz not null default now(),
  unique (course_id, event_key)
);

create index if not exists fad_log_events_course_time_idx
  on public.fad_log_events (course_id, occurred_at);

-- Una giornata di lezione FAD: quando è stata chiusa l'aula e come lo sappiamo
create table if not exists public.fad_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  day date not null,
  closed_at timestamptz,
  -- registrata (evento Moodle), ricostruita (uscite simultanee), manuale, non_determinabile
  closed_source text not null default 'non_determinabile'
    check (closed_source in ('registrata', 'ricostruita', 'manuale', 'non_determinabile')),
  closed_note text not null default '',
  closed_by text not null default '',
  manual boolean not null default false,
  -- giornata da non includere in dichiarazioni ed esportazioni (es. lezione in presenza)
  excluded boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, day)
);

create index if not exists fad_sessions_course_idx on public.fad_sessions (course_id, day);

-- Presenza di un alunno in una giornata
create table if not exists public.fad_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.fad_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  first_join_at timestamptz,
  exit_at timestamptz,
  -- log (uscita registrata), chiusura (uscita = chiusura aula), manuale
  exit_source text not null default ''
    check (exit_source in ('', 'log', 'chiusura', 'manuale')),
  -- fino_chiusura, uscito_prima, assente, da_verificare
  status text not null default 'da_verificare'
    check (status in ('fino_chiusura', 'uscito_prima', 'assente', 'da_verificare')),
  minutes integer,
  pause_minutes integer not null default 0,
  joins integer not null default 0,
  moodle_name text not null default '',
  manual boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists fad_attendance_student_idx on public.fad_attendance (student_id);

alter table public.fad_log_events enable row level security;
alter table public.fad_sessions enable row level security;
alter table public.fad_attendance enable row level security;

create policy "fad_log_events_all" on public.fad_log_events
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "fad_sessions_all" on public.fad_sessions
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "fad_attendance_all" on public.fad_attendance
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

create trigger fad_sessions_updated_at
  before update on public.fad_sessions
  for each row execute function app.set_updated_at();
create trigger fad_attendance_updated_at
  before update on public.fad_attendance
  for each row execute function app.set_updated_at();
