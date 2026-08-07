-- Notifiche in-app per staff/admin

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Inserimento solo via funzioni security definer
create or replace function app.insert_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text default ''
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_link, ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function app.notify_admins(
  p_type text,
  p_title text,
  p_body text,
  p_link text default ''
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id from public.profiles
    where role in ('superadmin', 'admin')
  loop
    perform app.insert_notification(r.id, p_type, p_title, p_body, p_link);
  end loop;
end;
$$;

create or replace function public.insert_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_link text default ''
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_staff()) then
    raise exception 'Non autorizzato';
  end if;
  return app.insert_notification(p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

grant execute on function public.insert_notification(uuid, text, text, text, text) to authenticated;

-- Notifica admin: nuovo utente pending
create or replace function app.trg_profile_notifications() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
begin
  if tg_op = 'INSERT' then
    if new.role = 'pending' then
      -- Utenti invitati da admin: profilo pending momentaneo, non richiedono approvazione
      if not exists (
        select 1 from auth.users u
        where u.id = new.id and u.invited_at is not null
      ) then
        perform app.notify_admins(
          'user_pending',
          'Nuovo utente in attesa',
          coalesce(new.full_name, '') || ' (' || new.email || ') richiede approvazione.',
          '/utenti'
        );
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    v_label := case new.role
      when 'superadmin' then 'Superadmin'
      when 'admin' then 'Amministratore'
      when 'staff' then 'Staff'
      when 'pending' then 'In attesa'
      else new.role
    end;

    if old.role = 'pending' and new.role <> 'pending' then
      perform app.insert_notification(
        new.id,
        'user_approved',
        'Account approvato',
        'Il tuo accesso è attivo con ruolo: ' || v_label || '.',
        '/'
      );
    elsif old.role <> 'pending' then
      perform app.insert_notification(
        new.id,
        'role_changed',
        'Ruolo aggiornato',
        'Il tuo ruolo è ora: ' || v_label || '.',
        '/'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profile_notifications on public.profiles;
create trigger profile_notifications
  after insert or update on public.profiles
  for each row execute function app.trg_profile_notifications();

-- Notifica admin: corso finito (da rendicontare)
create or replace function app.trg_course_notifications() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.status = 'finito'
    and old.status is distinct from 'finito'
  then
    perform app.notify_admins(
      'course_to_report',
      'Corso da rendicontare',
      new.name || coalesce(' — ' || new.edition, '') || ' è finito e deve essere rendicontato.',
      '/corsi/' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists course_notifications on public.courses;
create trigger course_notifications
  after update on public.courses
  for each row execute function app.trg_course_notifications();
