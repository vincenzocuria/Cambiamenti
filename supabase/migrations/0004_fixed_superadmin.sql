-- Superadmin fisso: solo curiavincenzo86@gmail.com
-- Gli altri utenti restano 'pending' finché un admin/superadmin non li abilita.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'staff', 'pending'));

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('superadmin', 'admin', 'staff')
  );
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('superadmin', 'admin')
  );
$$;

create or replace function app.is_superadmin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

grant execute on function app.is_superadmin() to authenticated;

-- Solo l'email superadmin riceve il ruolo; tutti gli altri restano pending
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when lower(coalesce(new.email, '')) = 'curiavincenzo86@gmail.com'
      then 'superadmin'
      else 'pending'
    end
  );
  return new;
end;
$$;

-- Impedisce demozione/eliminazione del superadmin
create or replace function app.protect_superadmin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if lower(old.email) = 'curiavincenzo86@gmail.com' or old.role = 'superadmin' then
      raise exception 'Il superadmin non può essere eliminato';
    end if;
    return old;
  end if;

  if lower(old.email) = 'curiavincenzo86@gmail.com' then
    new.role := 'superadmin';
    new.email := old.email;
  elsif old.role = 'superadmin' and new.role is distinct from 'superadmin' then
    raise exception 'Il ruolo superadmin non può essere modificato';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_superadmin on public.profiles;
create trigger protect_superadmin
  before update or delete on public.profiles
  for each row execute function app.protect_superadmin();

-- Solo admin/superadmin vedono la lista utenti (oltre al proprio profilo)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select app.is_admin()));

-- Backfill se l'account esiste già
update public.profiles
set role = 'superadmin'
where lower(email) = 'curiavincenzo86@gmail.com';
