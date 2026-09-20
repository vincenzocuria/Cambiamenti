-- Il profilo superadmin non è visibile agli altri admin.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    (select auth.uid()) = id
    or (
      (select app.is_admin())
      and (
        (select app.is_superadmin())
        or (
          role is distinct from 'superadmin'
          and lower(email) is distinct from 'curiavincenzo86@gmail.com'
        )
      )
    )
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (
    (select app.is_admin())
    and (
      (select app.is_superadmin())
      or (
        role is distinct from 'superadmin'
        and lower(email) is distinct from 'curiavincenzo86@gmail.com'
      )
    )
  )
  with check (
    (select app.is_admin())
    and (
      (select app.is_superadmin())
      or (
        role is distinct from 'superadmin'
        and lower(email) is distinct from 'curiavincenzo86@gmail.com'
      )
    )
  );

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (
    (select app.is_admin())
    and id <> (select auth.uid())
    and (
      (select app.is_superadmin())
      or (
        role is distinct from 'superadmin'
        and lower(email) is distinct from 'curiavincenzo86@gmail.com'
      )
    )
  );
