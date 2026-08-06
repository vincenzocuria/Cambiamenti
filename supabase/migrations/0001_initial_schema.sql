-- Schema privato per funzioni di supporto (non esposto via API)
create schema if not exists app;
grant usage on schema app to authenticated;

-- Profili utente con ruolo
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'pending' check (role in ('admin','staff','pending')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','staff')
  );
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function app.is_staff() to authenticated;
grant execute on function app.is_admin() to authenticated;

-- Il primo utente registrato diventa admin, gli altri restano 'pending'
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when not exists (select 1 from public.profiles where role = 'admin')
         then 'admin' else 'pending' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

create or replace function app.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Corsi di formazione
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  edition text not null default '',
  code text not null default '',
  cup text not null default '',
  notes text not null default '',
  start_date date,
  end_date date,
  duration_hours numeric(6,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.courses enable row level security;
create trigger courses_updated_at before update on public.courses
  for each row execute function app.set_updated_at();

-- Alunni
create table public.students (
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
alter table public.students enable row level security;
create trigger students_updated_at before update on public.students
  for each row execute function app.set_updated_at();

-- Docenti
create table public.teachers (
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
alter table public.teachers enable row level security;
create trigger teachers_updated_at before update on public.teachers
  for each row execute function app.set_updated_at();

-- Iscrizioni alunni ai corsi
create table public.course_students (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);
alter table public.course_students enable row level security;
create index course_students_student_idx on public.course_students (student_id);

-- Assegnazione docenti ai corsi
create table public.course_teachers (
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);
alter table public.course_teachers enable row level security;
create index course_teachers_teacher_idx on public.course_teachers (teacher_id);

-- Documenti caricati (documenti identita', moduli corso, altro)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  person_type text not null check (person_type in ('student','teacher')),
  person_id uuid not null,
  course_id uuid references public.courses(id) on delete set null,
  category text not null default 'module' check (category in ('identity','module','other')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create index documents_person_idx on public.documents (person_type, person_id);
create index documents_course_idx on public.documents (course_id);

-- Policy RLS: solo staff/admin accede ai dati
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or app.is_staff());
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy "profiles_delete_admin" on public.profiles for delete to authenticated
  using (app.is_admin() and id <> auth.uid());

create policy "courses_all" on public.courses for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy "students_all" on public.students for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy "teachers_all" on public.teachers for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy "course_students_all" on public.course_students for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy "course_teachers_all" on public.course_teachers for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy "documents_all" on public.documents for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
