-- Lezioni / eventi calendario (es. import ICS da JForma)
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  title text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room text not null default '',
  notes text not null default '',
  external_uid text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index calendar_events_external_uid_key
  on public.calendar_events (external_uid)
  where external_uid <> '';

create index calendar_events_course_idx on public.calendar_events (course_id);
create index calendar_events_starts_at_idx on public.calendar_events (starts_at);

alter table public.calendar_events enable row level security;

create policy "calendar_events_all" on public.calendar_events
  for all to authenticated
  using (app.is_staff())
  with check (app.is_staff());

create trigger calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function app.set_updated_at();
