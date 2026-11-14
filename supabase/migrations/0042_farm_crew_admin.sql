-- FarmCrew admins. Run this after 0041_farm_crew_leaderboard.sql.
-- Owners and admins edit the crew name, description, and visibility.
-- Owners and admins can promote members to admin.
-- Owners can remove admins and members. Admins can remove members only.

alter table public.farm_crew_member drop constraint if exists farm_crew_member_role_check;
alter table public.farm_crew_member
  add constraint farm_crew_member_role_check check (role in ('owner', 'admin', 'member'));

alter table public.farm_crew_member drop constraint if exists farm_crew_member_owner_accepted;
alter table public.farm_crew_member drop constraint if exists farm_crew_member_lead_accepted;
alter table public.farm_crew_member
  add constraint farm_crew_member_lead_accepted check (
    role not in ('owner', 'admin') or status = 'accepted'
  );

drop function if exists public.get_farm_crew(uuid);

create or replace function public.get_farm_crew(target uuid)
returns table (
  crew_id uuid,
  name text,
  description text,
  pet_type text,
  pet_color text,
  member_count integer,
  is_public boolean,
  role text
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
    farm_crew.description,
    farm_crew.pet_type,
    farm_crew.pet_color,
    (
      select count(*)::integer
      from public.farm_crew_member counted
      where counted.crew_id = farm_crew.id
        and counted.status = 'accepted'
    ),
    farm_crew.is_public,
    mine.role
  from public.farm_crew
  join public.farm_crew_member mine
    on mine.crew_id = farm_crew.id
    and mine.user_id = auth.uid()
    and mine.status = 'accepted'
  where farm_crew.id = target;
end;
$$;

revoke all on function public.get_farm_crew(uuid) from public, anon, authenticated;
grant execute on function public.get_farm_crew(uuid) to authenticated;

create or replace function public.update_farm_crew_settings(
  target uuid,
  input_name text,
  input_description text,
  input_public boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
  chosen_name text;
  chosen_description text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select role
  into actor
  from public.farm_crew_member
  where crew_id = target
    and user_id = auth.uid()
    and status = 'accepted';

  if actor is null or actor not in ('owner', 'admin') then
    raise exception 'You do not manage this FarmCrew.';
  end if;

  chosen_name := trim(regexp_replace(coalesce(input_name, ''), '\s+', ' ', 'g'));
  chosen_description := trim(regexp_replace(coalesce(input_description, ''), '\s+', ' ', 'g'));

  if chosen_name = '' or char_length(chosen_name) > 32 then
    raise exception 'Name the FarmCrew.';
  end if;

  if char_length(chosen_description) > 200 then
    raise exception 'Shorten the description.';
  end if;

  if input_public is null then
    raise exception 'Choose public or private.';
  end if;

  update public.farm_crew
  set
    name = chosen_name,
    description = chosen_description,
    is_public = input_public
  where id = target;
end;
$$;

revoke all on function public.update_farm_crew_settings(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.update_farm_crew_settings(uuid, text, text, boolean) to authenticated;

create or replace function public.list_farm_crew_members(target uuid)
returns table (
  user_id uuid,
  display_name text,
  role text
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
    member.role
  from public.farm_crew_member member
  join public.profiles on profiles.id = member.user_id
  where member.crew_id = target
    and member.status = 'accepted'
  order by
    case member.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    profiles.display_name;
end;
$$;

revoke all on function public.list_farm_crew_members(uuid) from public, anon, authenticated;
grant execute on function public.list_farm_crew_members(uuid) to authenticated;

create or replace function public.promote_farm_crew_member(target_crew uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select role
  into actor
  from public.farm_crew_member
  where crew_id = target_crew
    and user_id = auth.uid()
    and status = 'accepted';

  if actor is null or actor not in ('owner', 'admin') then
    raise exception 'You do not manage this FarmCrew.';
  end if;

  select role
  into target_role
  from public.farm_crew_member
  where crew_id = target_crew
    and user_id = target_user
    and status = 'accepted';

  if target_role is null then
    raise exception 'That farmer is not in this FarmCrew.';
  end if;

  if target_role = 'owner' then
    raise exception 'The owner stays in the crew.';
  end if;

  if target_role = 'admin' then
    raise exception 'That farmer is already an admin.';
  end if;

  update public.farm_crew_member
  set role = 'admin'
  where crew_id = target_crew
    and user_id = target_user
    and status = 'accepted'
    and role = 'member';
end;
$$;

revoke all on function public.promote_farm_crew_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.promote_farm_crew_member(uuid, uuid) to authenticated;

create or replace function public.kick_farm_crew_member(target_crew uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if target_user = auth.uid() then
    raise exception 'You cannot remove yourself.';
  end if;

  select role
  into actor
  from public.farm_crew_member
  where crew_id = target_crew
    and user_id = auth.uid()
    and status = 'accepted';

  if actor is null or actor not in ('owner', 'admin') then
    raise exception 'You do not manage this FarmCrew.';
  end if;

  select role
  into target_role
  from public.farm_crew_member
  where crew_id = target_crew
    and user_id = target_user
    and status = 'accepted';

  if target_role is null then
    raise exception 'That farmer is not in this FarmCrew.';
  end if;

  if target_role = 'owner' then
    raise exception 'The owner stays in the crew.';
  end if;

  if actor = 'admin' and target_role <> 'member' then
    raise exception 'Admins can only remove members.';
  end if;

  delete from public.farm_crew_member
  where crew_id = target_crew
    and user_id = target_user
    and status = 'accepted'
    and role <> 'owner'
    and (actor = 'owner' or role = 'member');
end;
$$;

revoke all on function public.kick_farm_crew_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kick_farm_crew_member(uuid, uuid) to authenticated;
