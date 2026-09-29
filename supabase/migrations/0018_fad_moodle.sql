-- Collegamento corsi FAD Moodle e registro presenze per lezione

alter table public.courses
  add column if not exists moodle_course_id bigint,
  add column if not exists moodle_bbb_id bigint,
  add column if not exists moodle_shortname text not null default '';

alter table public.calendar_events
  add column if not exists moodle_event_id bigint;

create table if not exists public.lesson_attendance (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid not null references public.calendar_events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  minutes numeric(8,1) not null default 0,
  present boolean not null default false,
  moodle_username text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_event_id, person_id)
);

create index if not exists lesson_attendance_event_idx
  on public.lesson_attendance (calendar_event_id);

alter table public.lesson_attendance enable row level security;

drop policy if exists "lesson_attendance_all" on public.lesson_attendance;
create policy "lesson_attendance_all" on public.lesson_attendance
  for all to authenticated
  using (app.is_staff())
  with check (app.is_staff());

drop trigger if exists lesson_attendance_updated_at on public.lesson_attendance;
create trigger lesson_attendance_updated_at
  before update on public.lesson_attendance
  for each row execute function app.set_updated_at();
