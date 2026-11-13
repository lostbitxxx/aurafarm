-- Who may see a farmer's status, and the status itself.
-- Run this after 0025_friendship.sql.
-- desk_seen_at and pet_seen_at are how the website and the desktop pet
-- combine into current_status. Friends never read those timestamps.
-- current_status is updated even when allow_status_seen is none.

alter table public.social_profile
  add column if not exists allow_status_seen text not null default 'friend_only';

alter table public.social_profile
  add column if not exists current_status text not null default 'offline';

alter table public.social_profile
  add column if not exists desk_seen_at timestamptz;

alter table public.social_profile
  add column if not exists pet_seen_at timestamptz;

alter table public.social_profile
  drop constraint if exists social_profile_allow_status_seen_check;

alter table public.social_profile
  add constraint social_profile_allow_status_seen_check
  check (allow_status_seen in ('friend_and_group', 'friend_only', 'group_only', 'none'));

alter table public.social_profile
  drop constraint if exists social_profile_current_status_check;

alter table public.social_profile
  add constraint social_profile_current_status_check
  check (current_status in ('online', 'aurafarming', 'offline'));

comment on column public.social_profile.allow_status_seen is
  'friend_and_group and friend_only show status to friends. group_only waits for groups. none hides status.';

comment on column public.social_profile.current_status is
  'online on the desk or pet, aurafarming in an active study session, otherwise offline.';

create or replace function public.sync_social_status(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  desk_at timestamptz;
  pet_at timestamptz;
  studying boolean;
  next_status text;
begin
  select desk_seen_at, pet_seen_at
  into desk_at, pet_at
  from public.social_profile
  where user_id = target
  for update;

  if not found then
    return;
  end if;

  if desk_at is not null and desk_at <= now() - interval '90 seconds' then
    desk_at := null;
  end if;

  if pet_at is not null and pet_at <= now() - interval '90 seconds' then
    pet_at := null;
  end if;

  studying := exists (
    select 1
    from public.study_sessions
    where user_id = target
      and status = 'active'
  );

  next_status := case
    when studying then 'aurafarming'
    when desk_at is not null or pet_at is not null then 'online'
    else 'offline'
  end;

  update public.social_profile
  set desk_seen_at = desk_at,
      pet_seen_at = pet_at,
      current_status = next_status
  where user_id = target;
end;
$$;

revoke all on function public.sync_social_status(uuid) from public, anon, authenticated;

create or replace function public.touch_social_presence(source text, present boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if source is distinct from 'desk' and source is distinct from 'pet' then
    raise exception 'Unknown presence';
  end if;

  perform public.ensure_social_profile(auth.uid());

  if source = 'desk' then
    update public.social_profile
    set desk_seen_at = case when present then now() else null end
    where user_id = auth.uid();
  else
    update public.social_profile
    set pet_seen_at = case when present then now() else null end
    where user_id = auth.uid();
  end if;

  perform public.sync_social_status(auth.uid());
end;
$$;

revoke all on function public.touch_social_presence(text, boolean) from public, anon, authenticated;
grant execute on function public.touch_social_presence(text, boolean) to authenticated;

create or replace function public.update_social_settings(next_invite text, next_seen text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if next_invite is null or next_invite not in ('open', 'manual', 'disabled') then
    raise exception 'Choose who can add you';
  end if;

  if next_seen is null
    or next_seen not in ('friend_and_group', 'friend_only', 'group_only', 'none') then
    raise exception 'Choose who can see your status';
  end if;

  perform public.ensure_social_profile(auth.uid());

  update public.social_profile
  set friend_invite = next_invite,
      allow_status_seen = next_seen
  where user_id = auth.uid();
end;
$$;

revoke all on function public.update_social_settings(text, text) from public, anon, authenticated;
grant execute on function public.update_social_settings(text, text) to authenticated;

create or replace function public.sync_social_status_from_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_social_status(new.user_id);
  return new;
end;
$$;

revoke all on function public.sync_social_status_from_session() from public, anon, authenticated;

drop trigger if exists study_sessions_social_status on public.study_sessions;
create trigger study_sessions_social_status
  after insert or update of status on public.study_sessions
  for each row
  execute function public.sync_social_status_from_session();

drop function if exists public.list_friends();

create or replace function public.list_friends()
returns table (
  friend_id uuid,
  display_name text,
  status text,
  incoming boolean,
  pet_type text,
  color text,
  hat text,
  clothes text,
  presence text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  perform public.sync_social_status(auth.uid());

  perform public.sync_social_status(
    case when friendship.user_a = auth.uid() then friendship.user_b else friendship.user_a end
  )
  from public.friendship
  where friendship.user_a = auth.uid()
    or friendship.user_b = auth.uid();

  return query
  select
    case when friendship.user_a = auth.uid() then friendship.user_b else friendship.user_a end,
    profiles.display_name,
    friendship.status,
    friendship.status = 'pending' and friendship.requested_by <> auth.uid(),
    user_pets.pet_type,
    user_pets.color,
    user_pets.hat,
    user_pets.clothes,
    case
      when friendship.status = 'accepted'
        and social_profile.allow_status_seen in ('friend_only', 'friend_and_group')
        then social_profile.current_status
      else 'invisible'
    end
  from public.friendship
  join public.profiles
    on profiles.id = case
      when friendship.user_a = auth.uid() then friendship.user_b
      else friendship.user_a
    end
  left join public.social_profile
    on social_profile.user_id = profiles.id
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
