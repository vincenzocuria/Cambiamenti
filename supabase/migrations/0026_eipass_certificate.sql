-- EIPASS privato: attestato conseguito (può essere diverso da quello acquistato) e scadenza facoltativa
alter table public.eipass_candidates
  add column if not exists certificate_type text not null default '',
  add column if not exists certificate_expiry date;
