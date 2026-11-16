-- Iter di certificazione ISO 9001: la certificazione (ente, auditor, stato, certificato),
-- le fasi (lista di audit, audit fase 1 e 2, non conformità, rilascio, sorveglianze, rinnovo)
-- e l'archivio dei documenti dell'iter (richieste, dichiarazioni, rapporti, certificato).

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  standard text not null default 'UNI EN ISO 9001:2015' check (char_length(standard) between 1 and 200),
  sector text not null default '' check (char_length(sector) <= 200),
  scope text not null default '' check (char_length(scope) <= 2000),
  body text not null default '' check (char_length(body) <= 300),
  auditor text not null default '' check (char_length(auditor) <= 300),
  consultant text not null default '' check (char_length(consultant) <= 300),
  status text not null default 'in_corso'
    check (status in ('in_corso', 'certificato', 'sospeso', 'scaduto', 'ritirato')),
  certificate_number text not null default '' check (char_length(certificate_number) <= 100),
  issued_on date,
  expires_on date,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certification_steps (
  id uuid primary key default gen_random_uuid(),
  certification_id uuid not null references public.certifications (id) on delete cascade,
  sort_order integer not null default 0,
  title text not null check (char_length(title) between 1 and 300),
  status text not null default 'da_fare' check (status in ('da_fare', 'in_corso', 'fatto', 'non_applicabile')),
  due_on date,
  done_on date,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.certification_files (
  id uuid primary key default gen_random_uuid(),
  certification_id uuid not null references public.certifications (id) on delete cascade,
  step_id uuid references public.certification_steps (id) on delete set null,
  category text not null default 'altro'
    check (category in ('richiesta', 'dichiarazione', 'rapporto', 'non_conformita', 'certificato', 'corrispondenza', 'altro')),
  title text not null check (char_length(title) between 1 and 300),
  doc_date date,
  notes text not null default '' check (char_length(notes) <= 2000),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists certification_steps_idx on public.certification_steps (certification_id, sort_order);
create index if not exists certification_files_idx on public.certification_files (certification_id, created_at desc);

alter table public.certifications enable row level security;
alter table public.certification_steps enable row level security;
alter table public.certification_files enable row level security;

create policy "certifications_staff" on public.certifications for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy "certification_steps_staff" on public.certification_steps for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy "certification_files_staff" on public.certification_files for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

-- La certificazione in corso, con le fasi tipiche dell'iter.
with c as (
  insert into public.certifications (standard, sector, scope, auditor, consultant, notes)
  select 'UNI EN ISO 9001:2015', 'EA/IAF 37 – Istruzione e formazione',
    'Progettazione ed erogazione di servizi di formazione professionale, finanziata e a catalogo, in aula e a distanza (FAD)',
    'Davide Avolio (Lead Auditor)', 'Damiano Ferraro',
    'Lista di audit ricevuta il 16/11/2026 da Davide Avolio tramite Damiano Ferraro.'
  where not exists (select 1 from public.certifications)
  returning id
)
insert into public.certification_steps (certification_id, sort_order, title, status, done_on)
select c.id, v.sort_order, v.title, v.status, v.done_on
from c, (values
  (10, 'Ricezione della lista di audit', 'fatto', date '2026-11-16'),
  (20, 'Preparazione della documentazione di sistema (elenco master)', 'in_corso', null::date),
  (30, 'Contratto o offerta con l''ente di certificazione', 'da_fare', null::date),
  (40, 'Audit interno', 'da_fare', null::date),
  (50, 'Riesame della Direzione', 'da_fare', null::date),
  (60, 'Audit di certificazione – fase 1 (documentale)', 'da_fare', null::date),
  (70, 'Audit di certificazione – fase 2 (in sede)', 'da_fare', null::date),
  (80, 'Chiusura delle non conformità e azioni correttive', 'da_fare', null::date),
  (90, 'Rilascio del certificato', 'da_fare', null::date),
  (100, 'Audit di sorveglianza – 1° anno', 'da_fare', null::date),
  (110, 'Audit di sorveglianza – 2° anno', 'da_fare', null::date),
  (120, 'Rinnovo del certificato (3° anno)', 'da_fare', null::date)
) as v(sort_order, title, status, done_on);
