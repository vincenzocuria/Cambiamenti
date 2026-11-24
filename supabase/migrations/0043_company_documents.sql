-- Documenti della società (non di un corso né di una persona): visura, statuto, DURC,
-- accreditamento regionale, polizze, sicurezza della sede, privacy, convenzioni...
-- Ogni voce ha al massimo un file (nel bucket documents, sotto company/), date di rilascio e
-- scadenza e un eventuale collegamento al documento ISO 9001 a cui fa da evidenza.
-- Il rinnovo (es. il DURC nuovo) crea una nuova voce e la precedente diventa «superata»,
-- così lo storico resta consultabile.

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'altro'
    check (category in ('societari', 'accreditamento', 'fiscali', 'sede', 'polizze', 'certificazioni', 'privacy', 'contratti', 'altro')),
  title text not null check (char_length(title) between 1 and 300),
  -- ente che lo rilascia (Camera di Commercio, INPS/INAIL, Regione Calabria, compagnia...)
  issuer text not null default '' check (char_length(issuer) <= 300),
  -- numero, protocollo o decreto (es. «DD n. 1234 del 05/03/2024», «prot. INAIL_12345»)
  reference text not null default '' check (char_length(reference) <= 300),
  issued_on date,
  expires_on date,
  notes text not null default '' check (char_length(notes) <= 2000),
  file_name text not null default '',
  storage_path text unique,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  -- documento ISO 9001 (elenco master) di cui questo file è l'evidenza
  quality_document_id uuid references public.quality_documents (id) on delete set null,
  -- versione precedente sostituita da questa (rinnovi)
  replaces_id uuid references public.company_documents (id) on delete set null,
  superseded_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_documents_category_idx on public.company_documents (category, sort_order);
create index if not exists company_documents_expires_idx on public.company_documents (expires_on) where superseded_at is null;
create index if not exists company_documents_quality_idx on public.company_documents (quality_document_id);

alter table public.company_documents enable row level security;
create policy "company_documents_read" on public.company_documents for select to authenticated
  using ((select app.is_staff()));
create policy "company_documents_insert" on public.company_documents for insert to authenticated
  with check ((select app.is_staff()));
create policy "company_documents_update" on public.company_documents for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy "company_documents_delete" on public.company_documents for delete to authenticated
  using ((select app.is_staff()));

-- Punto di partenza: i documenti che un ente di formazione accreditato tiene sempre pronti,
-- tutti «da caricare». Quelli chiesti dall'audit ISO sono già collegati all'elenco master.
insert into public.company_documents (category, title, issuer, notes, quality_document_id, sort_order)
select v.category, v.title, v.issuer, v.notes,
  (select q.id from public.quality_documents q where q.code = v.quality_code limit 1),
  v.sort_order
from (values
  ('societari', 'Visura camerale', 'Camera di Commercio', 'Per bandi e Regione di solito non più vecchia di 6 mesi', 'EXT-01', 10),
  ('societari', 'Atto costitutivo', 'Notaio', '', null, 20),
  ('societari', 'Statuto vigente', 'Notaio', '', null, 30),
  ('societari', 'Documento d''identità del legale rappresentante', '', '', null, 40),
  ('accreditamento', 'Decreto di accreditamento Regione Calabria', 'Regione Calabria', '', 'EXT-02', 110),
  ('accreditamento', 'Accreditamento Test Center EIPASS', 'Certipass', '', null, 120),
  ('fiscali', 'DURC', 'INPS / INAIL', 'Vale 120 giorni dalla richiesta', null, 210),
  ('fiscali', 'Certificato di attribuzione della Partita IVA', 'Agenzia delle Entrate', '', null, 220),
  ('fiscali', 'Dichiarazione conto corrente dedicato (tracciabilità flussi, L. 136/2010)', '', '', null, 230),
  ('sede', 'Contratto di locazione / titolo di disponibilità della sede', '', '', null, 310),
  ('sede', 'Planimetrie delle aule con capienza', '', '', 'EXT-04', 320),
  ('sede', 'Documento di Valutazione dei Rischi (DVR)', 'RSPP', '', 'EXT-05', 330),
  ('sede', 'Certificato di agibilità dei locali', 'Comune', '', null, 340),
  ('polizze', 'Polizza responsabilità civile (RCT/RCO)', '', '', null, 410),
  ('polizze', 'Polizza infortuni allievi', '', '', null, 420),
  ('privacy', 'Registro dei trattamenti (GDPR)', '', '', null, 610)
) as v(category, title, issuer, notes, quality_code, sort_order)
where not exists (select 1 from public.company_documents);
