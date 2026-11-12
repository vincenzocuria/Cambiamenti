-- Registro di protocollo: numerazione progressiva per anno della corrispondenza in uscita
-- e in entrata (PEC alla Regione, comunicazioni, note ricevute). I numeri non si cancellano:
-- un protocollo sbagliato si annulla, con il motivo.

create table if not exists public.protocol_entries (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2000 and 2100),
  number integer not null check (number > 0),
  entry_date date not null default current_date,
  direction text not null default 'uscita' check (direction in ('uscita', 'entrata', 'interno')),
  -- destinatario (in uscita) o mittente (in entrata)
  counterpart text not null default '' check (char_length(counterpart) <= 500),
  subject text not null check (char_length(subject) between 1 and 2000),
  channel text not null default 'PEC' check (channel in ('PEC', 'email', 'raccomandata', 'a mano', 'altro')),
  -- protocollo dell'altro ente, es. «Regione prot. n. 730877 del 08/09/2026»
  external_ref text not null default '' check (char_length(external_ref) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  course_id uuid references public.courses (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  pec_message_id uuid references public.pec_messages (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_reason text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (year, number),
  -- la data resta nell'anno della numerazione
  constraint protocol_entries_year_date check (extract(year from entry_date)::integer = year)
);
create index if not exists protocol_entries_date_idx on public.protocol_entries (year desc, number desc);
create index if not exists protocol_entries_course_idx on public.protocol_entries (course_id);

alter table public.protocol_entries enable row level security;

create policy "protocol_read" on public.protocol_entries for select to authenticated
  using ((select app.is_staff()));
create policy "protocol_insert" on public.protocol_entries for insert to authenticated
  with check ((select app.is_staff()));
create policy "protocol_update" on public.protocol_entries for update to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));
-- nessuna policy di delete: un numero di protocollo non si cancella

-- Assegna il prossimo numero dell'anno della data (o il numero indicato, per allinearsi al
-- registro precedente) e registra la voce. Il lock evita due numeri uguali in contemporanea.
create or replace function public.protocol_register(
  p_entry_date date,
  p_direction text,
  p_counterpart text,
  p_subject text,
  p_channel text default 'PEC',
  p_external_ref text default '',
  p_notes text default '',
  p_course_id uuid default null,
  p_document_id uuid default null,
  p_pec_message_id uuid default null,
  p_number integer default null
) returns public.protocol_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_year integer := extract(year from coalesce(p_entry_date, current_date))::integer;
  v_number integer;
  v_row public.protocol_entries;
begin
  if not app.is_staff() then
    raise exception 'Non autorizzato';
  end if;
  perform pg_advisory_xact_lock(hashtext('protocol_entries'), v_year);
  if p_number is not null then
    v_number := p_number;
  else
    select coalesce(max(number), 0) + 1 into v_number from public.protocol_entries where year = v_year;
  end if;
  insert into public.protocol_entries (
    year, number, entry_date, direction, counterpart, subject, channel, external_ref, notes,
    course_id, document_id, pec_message_id
  ) values (
    v_year, v_number, coalesce(p_entry_date, current_date), p_direction, coalesce(p_counterpart, ''),
    p_subject, coalesce(p_channel, 'PEC'), coalesce(p_external_ref, ''), coalesce(p_notes, ''),
    p_course_id, p_document_id, p_pec_message_id
  ) returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.protocol_register(date, text, text, text, text, text, text, uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.protocol_register(date, text, text, text, text, text, text, uuid, uuid, uuid, integer) to authenticated;
