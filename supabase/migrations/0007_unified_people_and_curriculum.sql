-- Anagrafica unica del personale (docente / tutor / amministrativo)
create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date,
  birth_place text not null default '',
  tax_code text not null default '',
  gender text not null default '',
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  province text not null default '',
  phone text not null default '',
  email text not null default '',
  iban text not null default '',
  bank_name text not null default '',
  bic text not null default '',
  doc_type text not null default '',
  doc_number text not null default '',
  doc_issued_by text not null default '',
  doc_issue_date date,
  doc_expiry_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.people enable row level security;
create trigger people_updated_at before update on public.people
  for each row execute function app.set_updated_at();
create policy "people_all" on public.people for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

create table public._person_id_map (
  old_id uuid primary key,
  person_id uuid not null
);

-- Docenti
insert into public.people select * from public.teachers;
insert into public._person_id_map (old_id, person_id)
select id, id from public.teachers;

-- Tutor (dedupe per CF)
insert into public._person_id_map (old_id, person_id)
select t.id,
  coalesce(
    (
      select p.id from public.people p
      where nullif(trim(t.tax_code), '') is not null
        and lower(p.tax_code) = lower(t.tax_code)
      limit 1
    ),
    t.id
  )
from public.tutors t;

insert into public.people
select t.*
from public.tutors t
join public._person_id_map m on m.old_id = t.id and m.person_id = t.id
where not exists (select 1 from public.people p where p.id = t.id);

-- Amministrativi (dedupe per CF)
insert into public._person_id_map (old_id, person_id)
select a.id,
  coalesce(
    (
      select p.id from public.people p
      where nullif(trim(a.tax_code), '') is not null
        and lower(p.tax_code) = lower(a.tax_code)
      limit 1
    ),
    a.id
  )
from public.admin_staff a
where not exists (select 1 from public._person_id_map m where m.old_id = a.id);

insert into public.people
select a.*
from public.admin_staff a
join public._person_id_map m on m.old_id = a.id and m.person_id = a.id
where not exists (select 1 from public.people p where p.id = a.id);

create unique index people_tax_code_unique
  on public.people (lower(tax_code))
  where tax_code <> '';

create table public.course_staff (
  course_id uuid not null references public.courses(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role text not null check (role in ('teacher', 'tutor', 'admin_staff')),
  created_at timestamptz not null default now(),
  primary key (course_id, person_id, role)
);

alter table public.course_staff enable row level security;
create index course_staff_person_idx on public.course_staff (person_id);
create index course_staff_role_idx on public.course_staff (course_id, role);
create policy "course_staff_all" on public.course_staff for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

insert into public.course_staff (course_id, person_id, role, created_at)
select ct.course_id, m.person_id, 'teacher', ct.created_at
from public.course_teachers ct
join public._person_id_map m on m.old_id = ct.teacher_id
on conflict do nothing;

insert into public.course_staff (course_id, person_id, role, created_at)
select ct.course_id, m.person_id, 'tutor', ct.created_at
from public.course_tutors ct
join public._person_id_map m on m.old_id = ct.tutor_id
on conflict do nothing;

insert into public.course_staff (course_id, person_id, role, created_at)
select ca.course_id, m.person_id, 'admin_staff', ca.created_at
from public.course_admin_staff ca
join public._person_id_map m on m.old_id = ca.admin_staff_id
on conflict do nothing;

alter table public.documents drop constraint if exists documents_person_type_check;
alter table public.documents add constraint documents_person_type_check
  check (
    person_type is null
    or person_type in ('student', 'staff', 'teacher', 'tutor', 'admin_staff')
  );

alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check
  check (category in ('identity', 'module', 'appointment', 'curriculum', 'other', 'generated'));

update public.documents d
set person_id = m.person_id,
    person_type = 'staff'
from public._person_id_map m
where d.person_id = m.old_id
  and d.person_type in ('teacher', 'tutor', 'admin_staff');

alter table public.document_templates drop constraint if exists document_templates_person_role_check;
alter table public.document_templates add constraint document_templates_person_role_check
  check (person_role in ('none', 'student', 'teacher', 'tutor', 'admin_staff', 'staff', 'any'));

create or replace function app.course_staffing_counts(p_course_id uuid)
returns table(teachers bigint, tutors bigint, admin_staff bigint)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.course_staff cs where cs.course_id = p_course_id and cs.role = 'teacher'),
    (select count(*) from public.course_staff cs where cs.course_id = p_course_id and cs.role = 'tutor'),
    (select count(*) from public.course_staff cs where cs.course_id = p_course_id and cs.role = 'admin_staff');
$$;

drop table public._person_id_map;
drop table if exists public.course_teachers;
drop table if exists public.course_tutors;
drop table if exists public.course_admin_staff;
drop table if exists public.teachers;
drop table if exists public.tutors;
drop table if exists public.admin_staff;
