-- Contratti di collaborazione (co.co.co.) del personale interno: tutor, direzione, amministrazione.
-- Ogni contratto è legato a una persona dell'anagrafica personale; il PDF firmato e il contratto
-- generato dal modello restano tra i documenti della persona.

create table if not exists public.collaboration_contracts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  -- attività affidate (art. 2 del contratto)
  role_tutor boolean not null default true,
  role_direction boolean not null default false,
  role_admin boolean not null default true,
  extra_activities text not null default '' check (char_length(extra_activities) <= 2000),
  -- corsi oggetto dell'incarico, come scritti nel contratto (es. «EIPASS 7 – SKILLS FOR GREEN»)
  courses_text text not null default '' check (char_length(courses_text) <= 1000),
  location text not null default 'la sede aziendale' check (char_length(location) <= 300),
  start_date date not null,
  end_date date,
  gross_amount numeric(12, 2) check (gross_amount is null or gross_amount >= 0),
  payment_terms text not null default
    'a saldo ogni fine corso, previa presentazione di Nota di Addebito/fattura o altro documento fiscale idoneo'
    check (char_length(payment_terms) <= 1000),
  notice_days integer check (notice_days is null or notice_days between 0 and 365),
  privacy_role text not null default 'soggetto autorizzato al trattamento'
    check (char_length(privacy_role) <= 300),
  signed_on date,
  status text not null default 'bozza' check (status in ('bozza', 'firmato', 'concluso', 'risolto')),
  -- PDF firmato (scansione) e contratto generato dal modello
  signed_document_id uuid references public.documents (id) on delete set null,
  generated_document_id uuid references public.documents (id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collaboration_contracts_dates check (end_date is null or end_date >= start_date),
  constraint collaboration_contracts_some_role check (role_tutor or role_direction or role_admin)
);

create index if not exists collaboration_contracts_person_idx
  on public.collaboration_contracts (person_id, start_date desc);
create index if not exists collaboration_contracts_end_idx
  on public.collaboration_contracts (end_date);

alter table public.collaboration_contracts enable row level security;

create policy "collaboration_contracts_all" on public.collaboration_contracts
  for all to authenticated
  using ((select app.is_staff()))
  with check ((select app.is_staff()));

create trigger collaboration_contracts_updated_at
  before update on public.collaboration_contracts
  for each row execute function app.set_updated_at();
