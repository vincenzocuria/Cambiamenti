-- Stato dell'iscrizione di un alunno a un corso: attivo, ritirato o trasferito ad altro corso.
-- La riga resta (storico): le presenze contano solo tra enrolled_on (incluso) e left_on (escluso).
alter table public.course_students
  add column if not exists status text not null default 'attivo'
    check (status in ('attivo', 'ritirato', 'trasferito')),
  add column if not exists enrolled_on date,
  add column if not exists left_on date,
  add column if not exists status_note text not null default '',
  add column if not exists transferred_from uuid references public.courses (id) on delete set null,
  add column if not exists transferred_to uuid references public.courses (id) on delete set null;
