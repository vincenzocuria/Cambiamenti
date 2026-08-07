-- Ciclo di vita corsi Regione Calabria
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'course_status' and n.nspname = 'public'
  ) then
    create type public.course_status as enum (
      'bozza',
      'in_creazione',
      'in_attivazione',
      'in_corso',
      'finito',
      'rendicontato',
      'esito_chiuso'
    );
  end if;
end $$;

alter table public.courses
  add column if not exists status public.course_status not null default 'bozza';

create index if not exists courses_status_idx on public.courses (status);
create index if not exists courses_start_date_idx on public.courses (start_date);
