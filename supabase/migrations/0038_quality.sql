-- Sistema qualità ISO 9001 (settore EA 37):
--  1. quality_documents: elenco master dei documenti interni ed esterni (politica, organigramma,
--     procedure, DVR, normative...) con revisione, scadenza del riesame e file;
--  2. certificates: registro progressivo degli attestati rilasciati (N/anno, come il protocollo),
--     con consegna; un numero non si cancella, si annulla con il motivo;
--  3. surveys / survey_responses: questionari di gradimento anonimi degli allievi a fine corso,
--     compilati da un link pubblico senza login.

-- 1. Elenco master documenti -------------------------------------------------------------

create table if not exists public.quality_documents (
  id uuid primary key default gen_random_uuid(),
  code text not null default '' check (char_length(code) <= 40),
  title text not null check (char_length(title) between 1 and 300),
  -- interno = prodotto da Cambia-Menti; esterno = norme, decreti, avvisi, DVR del locatore...
  origin text not null default 'interno' check (origin in ('interno', 'esterno')),
  -- area della lista di audit: direzione, risorse, erogazione, fornitori, miglioramento
  area text not null default 'direzione'
    check (area in ('direzione', 'risorse', 'erogazione', 'fornitori', 'miglioramento')),
  iso_clause text not null default '' check (char_length(iso_clause) <= 20),
  status text not null default 'da_predisporre'
    check (status in ('da_predisporre', 'bozza', 'vigente', 'superato')),
  revision text not null default '' check (char_length(revision) <= 20),
  issued_on date,
  review_due_on date,
  owner text not null default '' check (char_length(owner) <= 200),
  -- dove si trova se non è caricato (es. «affissa in aula 1», «sito web»)
  location text not null default '' check (char_length(location) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  file_name text not null default '',
  storage_path text unique,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quality_documents_area_idx on public.quality_documents (area, sort_order);

alter table public.quality_documents enable row level security;
create policy "quality_documents_read" on public.quality_documents for select to authenticated
  using ((select app.is_staff()));
create policy "quality_documents_insert" on public.quality_documents for insert to authenticated
  with check ((select app.is_staff()));
create policy "quality_documents_update" on public.quality_documents for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy "quality_documents_delete" on public.quality_documents for delete to authenticated
  using ((select app.is_staff()));

-- Punto di partenza: i documenti chiesti dalla lista di audit, tutti «da predisporre».
insert into public.quality_documents (code, title, origin, area, iso_clause, owner, sort_order)
select v.code, v.title, v.origin, v.area, v.iso_clause, v.owner, v.sort_order
from (values
  ('PQ-01', 'Politica per la Qualità (firmata, affissa in aula e pubblicata sul sito)', 'interno', 'direzione', '5.2', 'Direzione', 10),
  ('ORG-01', 'Organigramma aziendale', 'interno', 'direzione', '5.3', 'Direzione', 20),
  ('MAN-01', 'Mansionario (Direzione, Resp. Qualità, Coordinatore didattico, Segreteria didattica)', 'interno', 'direzione', '5.3', 'Direzione', 30),
  ('NOM-01', 'Lettere di nomina e responsabilità delle funzioni', 'interno', 'direzione', '5.3', 'Direzione', 40),
  ('EXT-01', 'Visura camerale aggiornata', 'esterno', 'direzione', '4.1', 'Amministrazione', 50),
  ('EXT-02', 'Decreto di accreditamento della Regione Calabria', 'esterno', 'direzione', '4.2', 'Direzione', 60),
  ('PR-01', 'Criteri di selezione, qualifica e valutazione dei docenti', 'interno', 'risorse', '7.2', 'Coordinatore didattico', 110),
  ('EXT-03', 'Attestati di formazione sicurezza del personale (D.Lgs. 81/08)', 'esterno', 'risorse', '7.2', 'Amministrazione', 120),
  ('EXT-04', 'Planimetrie delle aule con capienza massima', 'esterno', 'risorse', '7.1.3', 'Direzione', 130),
  ('EXT-05', 'Documento di Valutazione dei Rischi (DVR)', 'esterno', 'risorse', '7.1.4', 'RSPP', 140),
  ('REG-01', 'Registro dei controlli antincendio', 'esterno', 'risorse', '7.1.3', 'RSPP', 150),
  ('EXT-06', 'Verbali di verifica degli impianti (elettrico, messa a terra)', 'esterno', 'risorse', '7.1.3', 'RSPP', 160),
  ('PR-02', 'Scheda tecnica della piattaforma FAD (Moodle + BigBlueButton): tracciamento, log, requisiti, backup', 'interno', 'risorse', '7.1.3', 'Coordinatore didattico', 170),
  ('REG-02', 'Registro manutenzione attrezzature didattiche', 'interno', 'risorse', '7.1.5', 'Segreteria', 180),
  ('PR-03', 'Procedura di gestione documentale, archiviazione e backup dei registri', 'interno', 'risorse', '7.5', 'Resp. Qualità', 190),
  ('EXT-07', 'Normativa di riferimento (Accordi Stato-Regioni, D.I. 06/03/2013, avvisi regionali)', 'esterno', 'risorse', '7.5', 'Resp. Qualità', 200),
  ('PR-04', 'Procedura di progettazione dei corsi (o motivazione dell''esclusione del punto 8.3)', 'interno', 'erogazione', '8.3', 'Coordinatore didattico', 310),
  ('MOD-01', 'Catalogo corsi e schede informative', 'interno', 'erogazione', '8.2', 'Segreteria', 320),
  ('MOD-02', 'Modulo di iscrizione e verifica dei prerequisiti in ingresso', 'interno', 'erogazione', '8.2', 'Segreteria', 330),
  ('PR-05', 'Procedura di erogazione del corso (convocazioni, registri, verifiche, attestati)', 'interno', 'erogazione', '8.5', 'Coordinatore didattico', 340),
  ('REG-03', 'Elenco fornitori qualificati e schede di valutazione annuale', 'interno', 'fornitori', '8.4', 'Resp. Qualità', 410),
  ('MOD-03', 'Questionario di gradimento dei partecipanti', 'interno', 'miglioramento', '9.1.2', 'Resp. Qualità', 510),
  ('PR-06', 'Gestione di non conformità, reclami e azioni correttive', 'interno', 'miglioramento', '10.2', 'Resp. Qualità', 520),
  ('REG-04', 'Riesame della Direzione', 'interno', 'miglioramento', '9.3', 'Direzione', 530),
  ('REG-05', 'Audit interni', 'interno', 'miglioramento', '9.2', 'Resp. Qualità', 540)
) as v(code, title, origin, area, iso_clause, owner, sort_order)
where not exists (select 1 from public.quality_documents);

-- 2. Registro attestati ----------------------------------------------------------------------

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2000 and 2100),
  number integer not null check (number > 0),
  issued_on date not null default current_date,
  course_id uuid references public.courses (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  -- nome e codice fiscale copiati al rilascio: il registro resta leggibile anche se l'anagrafica cambia
  holder_name text not null check (char_length(holder_name) between 1 and 300),
  holder_tax_code text not null default '' check (char_length(holder_tax_code) <= 30),
  title text not null default 'Attestato di frequenza' check (char_length(title) between 1 and 300),
  hours numeric(7, 2),
  outcome text not null default '' check (char_length(outcome) <= 300),
  delivered_on date,
  delivery_method text not null default '' check (char_length(delivery_method) <= 200),
  document_id uuid references public.documents (id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 2000),
  cancelled_at timestamptz,
  cancelled_reason text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (year, number),
  constraint certificates_year_date check (extract(year from issued_on)::integer = year)
);
create index if not exists certificates_course_idx on public.certificates (course_id);
create index if not exists certificates_student_idx on public.certificates (student_id);
create index if not exists certificates_order_idx on public.certificates (year desc, number desc);

alter table public.certificates enable row level security;
create policy "certificates_read" on public.certificates for select to authenticated
  using ((select app.is_staff()));
create policy "certificates_insert" on public.certificates for insert to authenticated
  with check ((select app.is_staff()));
create policy "certificates_update" on public.certificates for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
-- nessuna policy di delete: un numero di attestato non si cancella

-- Rilascia un attestato a ciascuno degli allievi indicati, con numeri consecutivi dell'anno.
-- Salta chi ha già un attestato valido dello stesso corso e dello stesso titolo.
create or replace function public.certificates_issue(
  p_course_id uuid,
  p_student_ids uuid[],
  p_issued_on date,
  p_title text,
  p_hours numeric default null,
  p_outcome text default ''
) returns setof public.certificates
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_date date := coalesce(p_issued_on, current_date);
  v_year integer := extract(year from v_date)::integer;
  v_title text := coalesce(nullif(trim(p_title), ''), 'Attestato di frequenza');
  v_next integer;
  v_student record;
  v_row public.certificates;
begin
  if not app.is_staff() then
    raise exception 'Non autorizzato';
  end if;
  perform pg_advisory_xact_lock(hashtext('certificates'), v_year);
  select coalesce(max(number), 0) into v_next from public.certificates where year = v_year;
  for v_student in
    select s.id, trim(s.last_name || ' ' || s.first_name) as name, s.tax_code
    from public.students s
    where s.id = any (p_student_ids)
      and not exists (
        select 1 from public.certificates c
        where c.student_id = s.id and c.course_id is not distinct from p_course_id
          and c.title = v_title and c.cancelled_at is null
      )
    order by s.last_name, s.first_name
  loop
    v_next := v_next + 1;
    insert into public.certificates (
      year, number, issued_on, course_id, student_id, holder_name, holder_tax_code, title, hours, outcome
    ) values (
      v_year, v_next, v_date, p_course_id, v_student.id, coalesce(nullif(v_student.name, ''), '—'),
      coalesce(v_student.tax_code, ''), v_title, p_hours, coalesce(p_outcome, '')
    ) returning * into v_row;
    return next v_row;
  end loop;
end;
$$;

revoke all on function public.certificates_issue(uuid, uuid[], date, text, numeric, text) from public, anon;
grant execute on function public.certificates_issue(uuid, uuid[], date, text, numeric, text) to authenticated;

-- 3. Questionari di gradimento ----------------------------------------------------------------

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  -- il link pubblico: /questionario/<token>
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  closes_on date,
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists surveys_course_idx on public.surveys (course_id);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  -- punteggi 1..5 per domanda: {"docenza_chiarezza": 5, ...}
  scores jsonb not null default '{}'::jsonb,
  -- punteggio 1..5 per docente: {"<person_id>": 4, ...}
  teacher_scores jsonb not null default '{}'::jsonb,
  liked text not null default '' check (char_length(liked) <= 2000),
  suggestions text not null default '' check (char_length(suggestions) <= 2000),
  submitted_at timestamptz not null default now()
);
create index if not exists survey_responses_survey_idx on public.survey_responses (survey_id);

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
create policy "surveys_staff" on public.surveys for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
create policy "survey_responses_read" on public.survey_responses for select to authenticated
  using ((select app.is_staff()));
-- le risposte entrano solo da survey_submit; nessuna modifica o cancellazione

-- Dati minimi per mostrare il questionario a chi ha il link (nessun dato personale degli allievi).
create or replace function public.survey_public(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'course_name', c.name,
    'edition', c.edition,
    'code', c.code,
    'start_date', c.start_date,
    'end_date', c.end_date,
    'open', s.closed_at is null and (s.closes_on is null or s.closes_on >= current_date),
    'teachers', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', trim(p.first_name || ' ' || p.last_name))
        order by p.last_name, p.first_name)
      from public.course_staff cs join public.people p on p.id = cs.person_id
      where cs.course_id = c.id and cs.role = 'teacher'
    ), '[]'::jsonb)
  )
  from public.surveys s join public.courses c on c.id = s.course_id
  where s.token = p_token
$$;

-- Registra una risposta anonima. Accetta solo le domande note e punteggi interi da 1 a 5.
create or replace function public.survey_submit(
  p_token text,
  p_scores jsonb,
  p_teacher_scores jsonb default '{}'::jsonb,
  p_liked text default '',
  p_suggestions text default ''
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_survey public.surveys;
  v_key text;
  v_val jsonb;
  v_allowed text[] := array[
    'docenza_chiarezza', 'docenza_competenza', 'docenza_disponibilita',
    'organizzazione_calendario', 'organizzazione_segreteria', 'organizzazione_informazioni',
    'materiale_qualita', 'materiale_utilita',
    'ambiente_aule', 'ambiente_piattaforma',
    'complessivo_obiettivi', 'complessivo_aspettative', 'complessivo_consiglio'
  ];
begin
  select * into v_survey from public.surveys where token = p_token;
  if not found then
    raise exception 'Questionario non trovato';
  end if;
  if v_survey.closed_at is not null or (v_survey.closes_on is not null and v_survey.closes_on < current_date) then
    raise exception 'Il questionario è chiuso';
  end if;
  if jsonb_typeof(coalesce(p_scores, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_teacher_scores, '{}'::jsonb)) <> 'object' then
    raise exception 'Risposte non valide';
  end if;
  for v_key, v_val in select * from jsonb_each(coalesce(p_scores, '{}'::jsonb)) loop
    if not v_key = any (v_allowed) or jsonb_typeof(v_val) <> 'number'
       or (v_val #>> '{}')::numeric not in (1, 2, 3, 4, 5) then
      raise exception 'Risposta non valida: %', v_key;
    end if;
  end loop;
  for v_key, v_val in select * from jsonb_each(coalesce(p_teacher_scores, '{}'::jsonb)) loop
    if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric not in (1, 2, 3, 4, 5)
       or not exists (
         select 1 from public.course_staff cs
         where cs.course_id = v_survey.course_id and cs.role = 'teacher' and cs.person_id::text = v_key
       ) then
      raise exception 'Valutazione docente non valida';
    end if;
  end loop;
  if (select count(*) from public.survey_responses where survey_id = v_survey.id) >= 500 then
    raise exception 'Numero massimo di risposte raggiunto';
  end if;
  insert into public.survey_responses (survey_id, scores, teacher_scores, liked, suggestions)
  values (
    v_survey.id, coalesce(p_scores, '{}'::jsonb), coalesce(p_teacher_scores, '{}'::jsonb),
    left(coalesce(p_liked, ''), 2000), left(coalesce(p_suggestions, ''), 2000)
  );
  return true;
end;
$$;

revoke all on function public.survey_public(text) from public;
revoke all on function public.survey_submit(text, jsonb, jsonb, text, text) from public;
grant execute on function public.survey_public(text) to anon, authenticated;
grant execute on function public.survey_submit(text, jsonb, jsonb, text, text) to anon, authenticated;
