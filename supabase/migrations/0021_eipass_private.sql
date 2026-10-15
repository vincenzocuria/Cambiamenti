-- EIPASS privato: corsisti che acquistano la certificazione fuori dai corsi finanziati
create table public.eipass_candidates (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
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
  doc_type text not null default '',
  doc_number text not null default '',
  doc_expiry_date date,
  certification text not null default '',
  purchase_date date,
  exam_done boolean not null default false,
  exam_date date,
  -- Pagamento e fatturazione
  amount numeric(10, 2),
  vat_rate numeric(5, 2) not null default 22,
  payment_method text not null default '',
  payment_date date,
  invoice_status text not null default 'da_fatturare'
    check (invoice_status in ('da_fatturare', 'fatturato', 'non_richiesta')),
  invoice_number text not null default '',
  invoice_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index eipass_candidates_name_idx on public.eipass_candidates (last_name, first_name);
create index eipass_candidates_purchase_idx on public.eipass_candidates (purchase_date);
create index eipass_candidates_invoice_idx on public.eipass_candidates (invoice_status);

alter table public.eipass_candidates enable row level security;

create policy "eipass_candidates_all" on public.eipass_candidates
  for all to authenticated
  using (app.is_staff())
  with check (app.is_staff());

create trigger eipass_candidates_updated_at
  before update on public.eipass_candidates
  for each row execute function app.set_updated_at();

-- I documenti dei corsisti EIPASS usano la tabella documents con person_type 'eipass'
alter table public.documents drop constraint if exists documents_person_type_check;
alter table public.documents add constraint documents_person_type_check
  check (
    person_type is null
    or person_type in ('student', 'staff', 'teacher', 'tutor', 'admin_staff', 'eipass')
  );

-- Nuova categoria documento: copia dell'attestato/certificato
alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check
  check (
    category in ('identity', 'module', 'appointment', 'curriculum', 'certificate', 'other', 'generated')
  );

-- I template possono proporre tutte le categorie mostrate nell'interfaccia
alter table public.document_templates drop constraint if exists document_templates_default_category_check;
alter table public.document_templates add constraint document_templates_default_category_check
  check (
    default_category in ('identity', 'module', 'appointment', 'curriculum', 'certificate', 'other', 'generated')
  );
