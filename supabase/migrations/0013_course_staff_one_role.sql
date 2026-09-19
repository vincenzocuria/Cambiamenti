-- Una figura può ricoprire un solo ruolo per corso.

delete from public.course_staff a
using public.course_staff b
where a.course_id = b.course_id
  and a.person_id = b.person_id
  and a.role <> b.role
  and (
    a.created_at > b.created_at
    or (a.created_at = b.created_at and a.role > b.role)
  );

create unique index if not exists course_staff_one_role_per_person
  on public.course_staff (course_id, person_id);
