-- Tutor
create table public.tutors (
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
alter table public.tutors enable row level security;
create trigger tutors_updated_at before update on public.tutors
  for each row execute function app.set_updated_at();
create policy "tutors_all" on public.tutors for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

-- Personale amministrativo
create table public.admin_staff (
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
alter table public.admin_staff enable row level security;
create trigger admin_staff_updated_at before update on public.admin_staff
  for each row execute function app.set_updated_at();
create policy "admin_staff_all" on public.admin_staff for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

create table public.course_tutors (
  course_id uuid not null references public.courses(id) on delete cascade,
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, tutor_id)
);
alter table public.course_tutors enable row level security;
create index course_tutors_tutor_idx on public.course_tutors (tutor_id);
create policy "course_tutors_all" on public.course_tutors for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

create table public.course_admin_staff (
  course_id uuid not null references public.courses(id) on delete cascade,
  admin_staff_id uuid not null references public.admin_staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, admin_staff_id)
);
alter table public.course_admin_staff enable row level security;
create index course_admin_staff_admin_idx on public.course_admin_staff (admin_staff_id);
create policy "course_admin_staff_all" on public.course_admin_staff for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

alter table public.documents drop constraint if exists documents_person_type_check;
alter table public.documents add constraint documents_person_type_check
  check (person_type is null or person_type in ('student','teacher','tutor','admin_staff'));

alter table public.document_templates drop constraint if exists document_templates_person_role_check;
alter table public.document_templates add constraint document_templates_person_role_check
  check (person_role in ('none','student','teacher','tutor','admin_staff','any'));

create or replace function app.course_staffing_counts(p_course_id uuid)
returns table(teachers bigint, tutors bigint, admin_staff bigint)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.course_teachers ct where ct.course_id = p_course_id),
    (select count(*) from public.course_tutors ct where ct.course_id = p_course_id),
    (select count(*) from public.course_admin_staff ca where ca.course_id = p_course_id);
$$;

grant execute on function app.course_staffing_counts(uuid) to authenticated;

create or replace function app.course_staffing_ok(p_course_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select teachers >= 1 and tutors >= 1 and admin_staff >= 3
  from app.course_staffing_counts(p_course_id);
$$;

grant execute on function app.course_staffing_ok(uuid) to authenticated;
