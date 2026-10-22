-- Movimenti di denaro dei corsi finanziati:
--   in  = incassi dalla Regione (anticipo, saldo)
--   out = compensi erogati al personale del corso (docenti, tutor, amministrativi)
create table if not exists public.course_payments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  kind text not null default 'saldo'
    check (kind in ('anticipo', 'saldo', 'compenso', 'altro')),
  -- Solo per i compensi: a chi e per quale ruolo sul corso
  person_id uuid references public.people(id) on delete set null,
  role text check (role is null or role in ('teacher', 'tutor', 'admin_staff')),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  reference text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists course_payments_course_idx on public.course_payments (course_id);
create index if not exists course_payments_person_idx on public.course_payments (person_id);
alter table public.course_payments enable row level security;
drop policy if exists "course_payments_all" on public.course_payments;
create policy "course_payments_all" on public.course_payments for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
