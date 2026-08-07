-- Prestazione/trattamento INPS dell'alunno (Allegato 1.c GOL)
alter table public.students
  add column if not exists inps_benefit text not null default ''
  check (
    inps_benefit = ''
    or inps_benefit in ('naspi', 'adi', 'sfl', 'cig', 'nessuno')
  );

comment on column public.students.inps_benefit is
  'Categoria trattamento/prestazione INPS: naspi, adi, sfl, cig, nessuno';
