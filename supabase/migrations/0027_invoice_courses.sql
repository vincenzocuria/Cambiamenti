-- Fatture e note di debito collegate ai corsi: una riga della fattura per corso
-- (una nota di debito alla Regione può riguardare più corsi). Più la data d'incasso letta da Aruba.

create table if not exists public.invoice_courses (
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  -- Posizione della riga nella fattura (da 0)
  line_index integer not null,
  course_id uuid not null references public.courses (id) on delete cascade,
  -- balance = saldo del corso, advance = anticipo, allowance = indennità di frequenza
  kind text not null default 'other' check (kind in ('balance', 'advance', 'allowance', 'other')),
  amount numeric(12, 2),
  primary key (invoice_id, line_index)
);
create index if not exists invoice_courses_course_idx on public.invoice_courses (course_id);

alter table public.invoice_courses enable row level security;
drop policy if exists "invoice_courses_all" on public.invoice_courses;
create policy "invoice_courses_all" on public.invoice_courses for all to authenticated
  using ((select app.is_staff())) with check ((select app.is_staff()));

alter table public.invoices add column if not exists paid_at date;

-- Collega le fatture emesse già nel registro: «ID CORSO: 673.6, ED. 2 CUP: J32E22001120001»
with lines as (
  select
    i.id as invoice_id,
    (l.ord - 1)::integer as line_index,
    l.item ->> 'description' as description,
    round(coalesce((l.item ->> 'quantity')::numeric, 1) * coalesce((l.item ->> 'unit_price')::numeric, 0), 2) as amount
  from public.invoices i
  cross join lateral jsonb_array_elements(i.lines) with ordinality as l (item, ord)
  where i.direction = 'out'
),
refs as (
  select
    invoice_id,
    line_index,
    amount,
    description,
    substring(description from '(?i)ID\s*CORSO\s*:?\s*([0-9]+(?:\.[0-9]+)?)') as code,
    substring(description from '(?i)ID\s*CORSO\s*:?\s*[0-9.]*[0-9]\s*,?\s*ED\.?\s*([0-9]+)')::integer as edition,
    substring(upper(description) from '\m([A-Z][0-9]{2}[A-Z][0-9]{11})\M') as cup
  from lines
),
matches as (
  select r.invoice_id, r.line_index, r.amount, r.description, c.id as course_id,
    count(*) over (partition by r.invoice_id, r.line_index) as n
  from refs r
  join public.courses c
    on replace(upper(c.code), ' ', '') = r.code
   and substring(c.edition from '(?i)ED\.?\s*([0-9]+)')::integer = r.edition
   and (r.cup is null or c.cup = '' or upper(replace(c.cup, ' ', '')) = r.cup)
  where r.code is not null and r.edition is not null
)
insert into public.invoice_courses (invoice_id, line_index, course_id, kind, amount)
select
  invoice_id,
  line_index,
  course_id,
  case
    when description ~* 'indennit' then 'allowance'
    when description ~* '\m(anticip|acconto)' then 'advance'
    when description ~* '\msaldo\M' then 'balance'
    else 'other'
  end,
  amount
from matches
where n = 1
on conflict (invoice_id, line_index) do nothing;
