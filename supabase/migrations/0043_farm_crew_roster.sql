-- FarmCrew member portraits and join requests. Run this after 0042_farm_crew_admin.sql.
-- The member list includes each farmer's equipped pet.
-- Owners and admins can see, accept, and decline pending join requests.

drop function if exists public.list_farm_crew_members(uuid);

create or replace function public.list_farm_crew_members(target uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  pet_type text,
  pet_color text,
  hat text,
  clothes text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor text;
begin
  if auth.uid() is null then
    return;
  end if;

  select member.role
  into actor
  from public.farm_crew_member member
  where member.crew_id = target
    and member.user_id = auth.uid()
    and member.status = 'accepted';

  if actor is null or actor not in ('owner', 'admin') then
    raise exception 'You do not manage this FarmCrew.';
  end if;

  return query
  select
    profiles.id,
    coalesce(nullif(trim(profiles.display_name), ''), 'Farmer'),
    member.role,
    user_pets.pet_type,
    user_pets.color,
    user_pets.hat,
    user_pets.clothes
  from public.farm_crew_member member
  join public.profiles on profiles.id = member.user_id
  left join public.user_pets
    on user_pets.user_id = member.user_id
    and user_pets.is_desktop_active
  where member.crew_id = target
    and member.status = 'accepted'
  order by
    case member.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    profiles.display_name;
end;
$$;

revoke all on function public.list_farm_crew_members(uuid) from public, anon, authenticated;
grant execute on function public.list_farm_crew_members(uuid) to authenticated;

create or replace function public.list_farm_crew_join_requests(target uuid)
returns table (
  user_id uuid,
  display_name text,
  pet_type text,
  pet_color text,
  hat text,
  clothes text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor text;
begin
  if auth.uid() is null then
    return;
  end if;

  select member.role
  into actor
  from public.farm_crew_member member
  where member.crew_id = target
    and member.user_id = auth.uid()
    and member.status = 'accepted';

  if actor is null or actor not in ('owner', 'admin') then
    raise exception 'You do not manage this FarmCrew.';
  end if;

  return query
  select
    profiles.id,
    coalesce(nullif(trim(profiles.display_name), ''), 'Farmer'),
    user_pets.pet_type,
    user_pets.color,
    user_pets.hat,
    user_pets.clothes
  from public.farm_crew_member applicant
  join public.profiles on profiles.id = applicant.user_id
  left join public.user_pets
    on user_pets.user_id = applicant.user_id
    and user_pets.is_desktop_active
  where applicant.crew_id = target
    and applicant.status = 'pending'
  order by profiles.display_name;
end;
$$;

revoke all on function public.list_farm_crew_join_requests(uuid) from public, anon, authenticated;
grant execute on function public.list_farm_crew_join_requests(uuid) to authenticated;

create or replace function public.list_farm_crew_requests()
returns table (
  crew_id uuid,
  crew_name text,
  user_id uuid,
  display_name text
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
    farm_crew.id,
    farm_crew.name,
    applicant.user_id,
    coalesce(nullif(trim(profiles.display_name), ''), 'Farmer')
  from public.farm_crew_member manager
  join public.farm_crew on farm_crew.id = manager.crew_id
  join public.farm_crew_member applicant
    on applicant.crew_id = manager.crew_id
    and applicant.status = 'pending'
  join public.profiles on profiles.id = applicant.user_id
  where manager.user_id = auth.uid()
    and manager.role in ('owner', 'admin')
    and manager.status = 'accepted'
  order by farm_crew.name, profiles.display_name;
end;
$$;

revoke all on function public.list_farm_crew_requests() from public, anon, authenticated;
grant execute on function public.list_farm_crew_requests() to authenticated;

create or replace function public.accept_farm_crew_request(target_crew uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if not exists (
    select 1
    from public.farm_crew_member
    where crew_id = target_crew
      and user_id = auth.uid()
      and role in ('owner', 'admin')
      and status = 'accepted'
  ) then
    raise exception 'You do not manage this FarmCrew.';
  end if;

  update public.farm_crew_member
  set status = 'accepted',
      joined_at = now()
  where crew_id = target_crew
    and user_id = target_user
    and status = 'pending'
  returning user_id into updated_id;

  if updated_id is null then
    raise exception 'That request is no longer waiting.';
  end if;
end;
$$;

revoke all on function public.accept_farm_crew_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_farm_crew_request(uuid, uuid) to authenticated;

create or replace function public.decline_farm_crew_request(target_crew uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if not exists (
    select 1
    from public.farm_crew_member
    where crew_id = target_crew
      and user_id = auth.uid()
      and role in ('owner', 'admin')
      and status = 'accepted'
  ) then
    raise exception 'You do not manage this FarmCrew.';
  end if;

  delete from public.farm_crew_member
  where crew_id = target_crew
    and user_id = target_user
    and status = 'pending'
  returning user_id into removed_id;

  if removed_id is null then
    raise exception 'That request is no longer waiting.';
  end if;
end;
$$;

revoke all on function public.decline_farm_crew_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.decline_farm_crew_request(uuid, uuid) to authenticated;
