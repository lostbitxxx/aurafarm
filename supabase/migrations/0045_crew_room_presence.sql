-- Keep a farmer online through a background tab, and show that status in the crew room.
-- Run this after 0044_weekly_study_days.sql.
-- A hidden browser tab can only heartbeat about once a minute, so 90 seconds was
-- dropping people who were still on the desk. A late "I left" from a refresh
-- must not erase a heartbeat that just landed.

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

  if desk_at is not null and desk_at <= now() - interval '3 minutes' then
    desk_at := null;
  end if;

  if pet_at is not null and pet_at <= now() - interval '3 minutes' then
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
    where user_id = auth.uid()
      and (
        present
        or desk_seen_at is null
        or desk_seen_at <= now() - interval '15 seconds'
      );
  else
    update public.social_profile
    set pet_seen_at = case when present then now() else null end
    where user_id = auth.uid()
      and (
        present
        or pet_seen_at is null
        or pet_seen_at <= now() - interval '15 seconds'
      );
  end if;

  perform public.sync_social_status(auth.uid());
end;
$$;

revoke all on function public.touch_social_presence(text, boolean) from public, anon, authenticated;
grant execute on function public.touch_social_presence(text, boolean) to authenticated;

create or replace function public.list_farm_crew_room(target uuid)
returns table (
  farmer_id uuid,
  display_name text,
  pet_type text,
  pet_color text,
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

  if not exists (
    select 1
    from public.farm_crew_member
    where crew_id = target
      and user_id = auth.uid()
      and status = 'accepted'
  ) then
    return;
  end if;

  perform public.sync_social_status(member.user_id)
  from public.farm_crew_member member
  where member.crew_id = target
    and member.status = 'accepted';

  return query
  select
    profiles.id,
    coalesce(nullif(trim(profiles.display_name), ''), 'Farmer'),
    coalesce(user_pets.pet_type, 'baby_slime'),
    user_pets.color,
    user_pets.hat,
    user_pets.clothes,
    social_profile.current_status
  from public.farm_crew_member member
  join public.profiles on profiles.id = member.user_id
  join public.social_profile on social_profile.user_id = member.user_id
  left join public.user_pets
    on user_pets.user_id = member.user_id
    and user_pets.is_desktop_active
  where member.crew_id = target
    and member.status = 'accepted'
    and social_profile.current_status in ('online', 'aurafarming')
    and (
      member.user_id = auth.uid()
      or social_profile.allow_status_seen <> 'none'
    )
  order by profiles.display_name
  limit 30;
end;
$$;

revoke all on function public.list_farm_crew_room(uuid) from public, anon, authenticated;
grant execute on function public.list_farm_crew_room(uuid) to authenticated;
