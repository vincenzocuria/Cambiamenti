-- Fatturazione: clienti, fatture emesse/ricevute (anche importate da Aruba)

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  -- Ragione sociale (aziende/enti) oppure vuota per le persone fisiche
  company_name text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  vat_number text not null default '',
  tax_code text not null default '',
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  province text not null default '',
  country text not null default 'IT',
  sdi_code text not null default '0000000',
  pec text not null default '',
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_name_idx on public.customers (company_name, last_name, first_name);

alter table public.customers enable row level security;
create policy "customers_all" on public.customers
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create trigger customers_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  -- out = emessa, in = ricevuta
  direction text not null check (direction in ('out', 'in')),
  -- draft = bozza nell'app, sent = inviata ad Aruba dall'app, imported = letta da Aruba
  status text not null default 'draft' check (status in ('draft', 'sent', 'imported')),
  doc_type text not null default 'TD01',
  number text not null default '',
  invoice_date date,
  customer_id uuid references public.customers (id) on delete set null,
  eipass_candidate_id uuid references public.eipass_candidates (id) on delete set null,
  -- Controparte: cliente per le emesse, fornitore per le ricevute
  counterpart_name text not null default '',
  counterpart_vat text not null default '',
  counterpart_tax_code text not null default '',
  taxable numeric(12, 2),
  vat_amount numeric(12, 2),
  stamp numeric(12, 2),
  total numeric(12, 2),
  payment_method text not null default '',
  payment_due date,
  causale text not null default '',
  lines jsonb not null default '[]'::jsonb,
  notes text not null default '',
  -- Dati Aruba / SdI
  aruba_filename text,
  sdi_id text not null default '',
  sdi_status text not null default '',
  sdi_status_label text not null default '',
  xml text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- I null sono distinti: le bozze senza file non si scontrano
alter table public.invoices
  add constraint invoices_aruba_file_key unique (direction, aruba_filename);
create index invoices_date_idx on public.invoices (direction, invoice_date desc);
create index invoices_customer_idx on public.invoices (customer_id);

alter table public.invoices enable row level security;
create policy "invoices_all" on public.invoices
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function app.set_updated_at();
