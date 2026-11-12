-- Registro FAD: nei giorni in cui l'alunno non fa parte del corso la riga resta,
-- con stato ritirato / trasferito / non_iscritto (prima dell'ingresso).
alter table public.fad_attendance drop constraint if exists fad_attendance_status_check;
alter table public.fad_attendance add constraint fad_attendance_status_check
  check (status in ('fino_chiusura', 'uscito_prima', 'assente', 'da_verificare', 'ritirato', 'trasferito', 'non_iscritto'));
