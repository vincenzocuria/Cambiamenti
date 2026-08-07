-- Rimuove template con lo stesso nome (tiene il più vecchio) e impone unicità.
with ranked as (
  select
    id,
    row_number() over (partition by name order by created_at asc, id asc) as rn
  from public.document_templates
),
dupes as (
  select id from ranked where rn > 1
)
update public.documents d
set template_id = null
where d.template_id in (select id from dupes);

delete from public.document_templates t
using (
  select id
  from (
    select
      id,
      row_number() over (partition by name order by created_at asc, id asc) as rn
    from public.document_templates
  ) ranked
  where rn > 1
) dupes
where t.id = dupes.id;

create unique index if not exists document_templates_name_uidx
  on public.document_templates (name);
