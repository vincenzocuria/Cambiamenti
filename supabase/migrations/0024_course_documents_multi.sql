-- Documenti che valgono per più corsi (verbali della Regione, autodichiarazioni)
-- e importi letti dai verbali, corso per corso.

create table if not exists public.document_courses (
  document_id uuid not null references public.documents(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (document_id, course_id)
);
create index if not exists document_courses_course_idx on public.document_courses (course_id);
alter table public.document_courses enable row level security;
drop policy if exists "document_courses_all" on public.document_courses;
create policy "document_courses_all" on public.document_courses for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

-- I documenti già legati a un corso entrano nel collegamento
insert into public.document_courses (document_id, course_id)
select id, course_id from public.documents where course_id is not null
on conflict do nothing;

-- documents.course_id resta il corso «principale»: ogni volta che viene impostato
-- compare anche tra i corsi collegati (così il resto dell'app non cambia).
create or replace function app.documents_link_course()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.course_id is not null then
    insert into public.document_courses (document_id, course_id)
    values (new.id, new.course_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_link_course on public.documents;
create trigger documents_link_course
  after insert or update of course_id on public.documents
  for each row execute function app.documents_link_course();

-- Nuove categorie: verbale e autodichiarazione
alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check
  check (
    category in (
      'identity', 'module', 'appointment', 'curriculum', 'certificate', 'other', 'generated',
      'report', 'declaration'
    )
  );
alter table public.document_templates drop constraint if exists document_templates_default_category_check;
alter table public.document_templates add constraint document_templates_default_category_check
  check (
    default_category in (
      'identity', 'module', 'appointment', 'curriculum', 'certificate', 'other', 'generated',
      'report', 'declaration'
    )
  );

-- Righe dei verbali: una per corso, con gli importi riconosciuti dalla Regione
create table if not exists public.course_report_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  subject text not null default '',
  protocol_number text not null default '',
  protocol_date date,
  report_course_code text not null default '',
  report_edition text not null default '',
  membership_act text not null default '',
  students_trained integer,
  start_date date,
  end_date date,
  amount_budget numeric(12, 2),
  amount_recognized numeric(12, 2),
  amount_advance numeric(12, 2),
  amount_balance numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (document_id, course_id)
);
create index if not exists course_report_lines_course_idx on public.course_report_lines (course_id);
alter table public.course_report_lines enable row level security;
drop policy if exists "course_report_lines_all" on public.course_report_lines;
create policy "course_report_lines_all" on public.course_report_lines for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
