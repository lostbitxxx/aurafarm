-- Friend codes and friendship pairs.
-- Run this after 0024_collection_level_rewards.sql.
--
-- social_profile.friend_invite:
--   open     — a request with this code is accepted immediately
--   manual   — a request stays pending until this farmer accepts
--   disabled — new requests are refused

create table if not exists public.social_profile (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  friend_code text not null unique,
  friend_invite text not null default 'manual',
  constraint social_profile_friend_code_check
    check (friend_code ~ '^[ABCDEFGHIJKLMNPQRSTUVWXYZ23456789]{8}$'),
  constraint social_profile_friend_invite_check
    check (friend_invite in ('open', 'manual', 'disabled'))
);

comment on column public.social_profile.friend_code is
  'Code another farmer types to send a friend request.';

comment on column public.social_profile.friend_invite is
  'open accepts immediately, manual waits for acceptance, disabled refuses new requests.';

create table if not exists public.friendship (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  befriend_at timestamptz,
  primary key (user_a, user_b),
  constraint friendship_ordered_pair check (user_a < user_b),
  constraint friendship_requested_by_member check (requested_by = user_a or requested_by = user_b),
  constraint friendship_status_check check (status in ('pending', 'accepted')),
  constraint friendship_befriend_at_check check (
    (status = 'pending' and befriend_at is null)
    or (status = 'accepted' and befriend_at is not null)
  )
);

comment on column public.friendship.befriend_at is
  'When the friendship was accepted. Null while status is pending.';

create index if not exists friendship_user_b_idx on public.friendship (user_b);

alter table public.social_profile enable row level security;
alter table public.friendship enable row level security;

drop policy if exists "social_profile_select_own" on public.social_profile;
create policy "social_profile_select_own"
  on public.social_profile
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "friendship_select_own" on public.friendship;
create policy "friendship_select_own"
  on public.friendship
  for select
  to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

revoke all on table public.social_profile from public, anon, authenticated;
revoke all on table public.friendship from public, anon, authenticated;
grant select on table public.social_profile to authenticated;
grant select on table public.friendship to authenticated;

create or replace function public.ensure_social_profile(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt integer;
  i integer;
begin
  if exists (select 1 from public.social_profile where user_id = target) then
    return;
  end if;

  for attempt in 1..30 loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    begin
      insert into public.social_profile (user_id, friend_code, friend_invite)
      values (target, candidate, 'manual');
      return;
    exception
      when unique_violation then
        if exists (select 1 from public.social_profile where user_id = target) then
          return;
        end if;
    end;
  end loop;

  raise exception 'Could not create a friend code';
end;
$$;

revoke all on function public.ensure_social_profile(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
  has_display boolean;
  has_email boolean;
begin
  chosen_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Farmer'
  );
  chosen_name := left(chosen_name, 32);

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) into has_display;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_email;

  if has_display and has_email then
    insert into public.profiles (id, display_name, email)
    values (new.id, chosen_name, coalesce(new.email, ''))
    on conflict (id) do nothing;
  elsif has_display then
    insert into public.profiles (id, display_name)
    values (new.id, chosen_name)
    on conflict (id) do nothing;
  elsif has_email then
    insert into public.profiles (id, email)
    values (new.id, coalesce(new.email, ''))
    on conflict (id) do nothing;
  end if;

  insert into public.user_pets (user_id, pet_type, level, is_desktop_active)
  select new.id, 'baby_slime', 1, true
  where not exists (
    select 1 from public.user_pets where user_id = new.id
  );

  perform public.ensure_social_profile(new.id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.send_friend_request(target_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  normalized text := upper(trim(coalesce(target_code, '')));
  owner_id uuid;
  invite_mode text;
  low_id uuid;
  high_id uuid;
  existing_status text;
  existing_by uuid;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  if normalized !~ '^[ABCDEFGHIJKLMNPQRSTUVWXYZ23456789]{8}$' then
    raise exception 'Unknown friend code';
  end if;

  select user_id, friend_invite
  into owner_id, invite_mode
  from public.social_profile
  where friend_code = normalized;

  if owner_id is null then
    raise exception 'Unknown friend code';
  end if;

  if owner_id = caller then
    raise exception 'That is your friend code';
  end if;

  if caller < owner_id then
    low_id := caller;
    high_id := owner_id;
  else
    low_id := owner_id;
    high_id := caller;
  end if;

  select status, requested_by
  into existing_status, existing_by
  from public.friendship
  where user_a = low_id
    and user_b = high_id
  for update;

  if existing_status = 'accepted' then
    raise exception 'Already friends';
  end if;

  if existing_status = 'pending' and existing_by = caller then
    raise exception 'Friend request already sent';
  end if;

  if existing_status = 'pending' and existing_by = owner_id then
    update public.friendship
    set status = 'accepted',
        befriend_at = now()
    where user_a = low_id
      and user_b = high_id;
    return;
  end if;

  if invite_mode = 'disabled' then
    raise exception 'Friend requests are closed';
  end if;

  if invite_mode = 'open' then
    begin
      insert into public.friendship (user_a, user_b, requested_by, status, befriend_at)
      values (low_id, high_id, caller, 'accepted', now());
    exception
      when unique_violation then
        raise exception 'Friend request already sent';
    end;
    return;
  end if;

  begin
    insert into public.friendship (user_a, user_b, requested_by, status, befriend_at)
    values (low_id, high_id, caller, 'pending', null);
  exception
    when unique_violation then
      raise exception 'Friend request already sent';
  end;
end;
$$;

revoke all on function public.send_friend_request(text) from public, anon, authenticated;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.accept_friend(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  updated_id uuid;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  if target_user is null or target_user = caller then
    raise exception 'No friend request to accept';
  end if;

  update public.friendship
  set status = 'accepted',
      befriend_at = now()
  where status = 'pending'
    and requested_by = target_user
    and (
      (user_a = caller and user_b = target_user)
      or (user_b = caller and user_a = target_user)
    )
  returning user_a into updated_id;

  if updated_id is null then
    raise exception 'No friend request to accept';
  end if;
end;
$$;

revoke all on function public.accept_friend(uuid) from public, anon, authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;

create or replace function public.decline_friend(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  removed_id uuid;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  if target_user is null or target_user = caller then
    raise exception 'No friend request to decline';
  end if;

  delete from public.friendship
  where status = 'pending'
    and requested_by = target_user
    and (
      (user_a = caller and user_b = target_user)
      or (user_b = caller and user_a = target_user)
    )
  returning user_a into removed_id;

  if removed_id is null then
    raise exception 'No friend request to decline';
  end if;
end;
$$;

revoke all on function public.decline_friend(uuid) from public, anon, authenticated;
grant execute on function public.decline_friend(uuid) to authenticated;

create or replace function public.list_friends()
returns table (
  friend_id uuid,
  display_name text,
  status text,
  incoming boolean,
  pet_type text,
  color text,
  hat text,
  clothes text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    case when friendship.user_a = auth.uid() then friendship.user_b else friendship.user_a end,
    profiles.display_name,
    friendship.status,
    friendship.status = 'pending' and friendship.requested_by <> auth.uid(),
    user_pets.pet_type,
    user_pets.color,
    user_pets.hat,
    user_pets.clothes
  from public.friendship
  join public.profiles
    on profiles.id = case
      when friendship.user_a = auth.uid() then friendship.user_b
      else friendship.user_a
    end
  left join public.user_pets
    on user_pets.user_id = profiles.id
    and user_pets.is_desktop_active
  where friendship.user_a = auth.uid()
    or friendship.user_b = auth.uid()
  order by profiles.display_name;
end;
$$;

revoke all on function public.list_friends() from public, anon, authenticated;
grant execute on function public.list_friends() to authenticated;

select public.ensure_social_profile(id)
from public.profiles;
