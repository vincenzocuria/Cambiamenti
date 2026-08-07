-- Credenziali FAD (piattaforma e-learning) per figure e alunni
alter table public.people
  add column if not exists fad_email text not null default '',
  add column if not exists fad_password text not null default '';

alter table public.students
  add column if not exists fad_email text not null default '',
  add column if not exists fad_password text not null default '';
