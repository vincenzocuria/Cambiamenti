-- Figure esterne al corso (preparatore, ricerca e reclutamento allievi, ecc.):
-- nuovo ruolo 'external' su course_staff, con la descrizione libera del ruolo in role_label.
alter table public.course_staff add column if not exists role_label text not null default '';

alter table public.course_staff drop constraint if exists course_staff_role_check;
alter table public.course_staff add constraint course_staff_role_check
  check (role in ('teacher', 'tutor', 'admin_staff', 'external'));

alter table public.course_payments drop constraint if exists course_payments_role_check;
alter table public.course_payments add constraint course_payments_role_check
  check (role is null or role in ('teacher', 'tutor', 'admin_staff', 'external'));
