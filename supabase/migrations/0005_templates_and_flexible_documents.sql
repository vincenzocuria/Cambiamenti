-- Template testuali per generazione documenti
create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  body text not null default '',
  requires_course boolean not null default false,
  person_role text not null default 'none'
    check (person_role in ('none', 'student', 'teacher', 'any')),
  default_category text not null default 'module'
    check (default_category in ('identity', 'module', 'appointment', 'other', 'generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_templates enable row level security;

create policy "document_templates_all" on public.document_templates
  for all to authenticated
  using ((select app.is_staff()))
  with check ((select app.is_staff()));

create trigger document_templates_updated_at
  before update on public.document_templates
  for each row execute function app.set_updated_at();

-- Documenti: persona e/o corso (lettera incarico = docente + corso)
alter table public.documents drop constraint if exists documents_person_type_check;
alter table public.documents drop constraint if exists documents_category_check;

alter table public.documents alter column person_type drop not null;
alter table public.documents alter column person_id drop not null;

alter table public.documents
  add constraint documents_person_type_check
    check (person_type is null or person_type in ('student', 'teacher')),
  add constraint documents_category_check
    check (category in ('identity', 'module', 'appointment', 'other', 'generated')),
  add constraint documents_person_pair
    check (
      (person_id is null and person_type is null)
      or (person_id is not null and person_type is not null)
    ),
  add constraint documents_has_target
    check (person_id is not null or course_id is not null);

alter table public.documents
  add column if not exists template_id uuid references public.document_templates(id) on delete set null,
  add column if not exists title text not null default '';

create index if not exists documents_template_idx on public.documents (template_id);

-- Consenti HTML/testo generati nel bucket documenti
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/html'
]
where id = 'documents';
