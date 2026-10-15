-- Documenti del personale di corso: dichiarazioni docente/non docente e lettera di incarico.

-- Dati del finanziamento del corso, citati nei documenti
alter table public.courses
  add column if not exists funding_decree text not null default '',
  add column if not exists funding_program text not null default '';

-- Dati dell'incarico della figura sul corso (moduli, ore, compenso orario)
alter table public.course_staff
  add column if not exists modules text not null default '',
  add column if not exists hours numeric(7,2),
  add column if not exists hourly_rate numeric(9,2);

