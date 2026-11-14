-- FarmCrews. Run this after 0038_achievements.sql.
-- A farmer can belong to more than one crew. Public crews are listed for requests.
-- A crew code sends a request that the owner accepts.
-- The room lists accepted members who are online or aurafarming.
-- The caller is included. Other members appear when groups may see their status.

create table if not exists public.farm_crew (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  crew_code text not null unique,
  pet_type text not null default 'baby_slime',
  pet_color text,
  is_public boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint farm_crew_name_check check (char_length(name) between 1 and 32),
  constraint farm_crew_description_check check (char_length(description) <= 200),
  constraint farm_crew_code_check check (crew_code ~ '^[ABCDEFGHIJKLMNPQRSTUVWXYZ23456789]{8}$'),
  constraint farm_crew_pet_type_check check (pet_type in ('baby_slime', 'lantern_moth', 'river_newt'))
);

comment on table public.farm_crew is
  'A FarmCrew. crew_code is what another farmer types to request membership.';

create table if not exists public.farm_crew_member (
  crew_id uuid not null references public.farm_crew (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  status text not null,
  requested_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (crew_id, user_id),
  constraint farm_crew_member_role_check check (role in ('owner', 'member')),
  constraint farm_crew_member_status_check check (status in ('pending', 'accepted')),
  constraint farm_crew_member_owner_accepted check (role <> 'owner' or status = 'accepted'),
  constraint farm_crew_member_joined_check check (
    (status = 'pending' and joined_at is null)
    or (status = 'accepted' and joined_at is not null)
  )
);

create unique index if not exists farm_crew_one_owner_idx
  on public.farm_crew_member (crew_id)
  where role = 'owner';

create index if not exists farm_crew_member_user_idx
  on public.farm_crew_member (user_id);

alter table public.farm_crew enable row level security;
alter table public.farm_crew_member enable row level security;

revoke all on table public.farm_crew from public, anon, authenticated;
revoke all on table public.farm_crew_member from public, anon, authenticated;

create or replace function public.join_farm_crew(target uuid, require_public boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  crew_name text;
  crew_public boolean;
  existing_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select name, is_public
  into crew_name, crew_public
  from public.farm_crew
  where id = target;

  if crew_name is null then
    raise exception 'This FarmCrew is not open.';
  end if;

  if require_public and not crew_public then
    raise exception 'This FarmCrew is not open.';
  end if;

  select status
  into existing_status
  from public.farm_crew_member
  where crew_id = target
    and user_id = auth.uid();

  if existing_status = 'accepted' then
    raise exception 'You are already in this FarmCrew.';
  end if;

  if existing_status = 'pending' then
    raise exception 'Request already sent.';
  end if;

  insert into public.farm_crew_member (crew_id, user_id, role, status, joined_at)
  values (target, auth.uid(), 'member', 'pending', null);

  return crew_name;
end;
$$;

revoke all on function public.join_farm_crew(uuid, boolean) from public, anon, authenticated;

create or replace function public.create_farm_crew(input_name text, input_description text, input_public boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  pet_types constant text[] := array['baby_slime', 'lantern_moth', 'river_newt'];
  colors constant text[] := array['sage', 'honey', 'sky', 'lavender', 'mint', 'coral'];
  chosen_name text;
  chosen_description text;
  candidate text;
  created_id uuid;
  attempt integer;
  i integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
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

  for attempt in 1..30 loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;

    begin
      insert into public.farm_crew (name, description, crew_code, pet_type, pet_color, is_public, created_by)
      values (
        chosen_name,
        chosen_description,
        candidate,
        pet_types[1 + floor(random() * array_length(pet_types, 1))::integer],
        colors[1 + floor(random() * array_length(colors, 1))::integer],
        input_public,
        auth.uid()
      )
      returning id into created_id;

      insert into public.farm_crew_member (crew_id, user_id, role, status, joined_at)
      values (created_id, auth.uid(), 'owner', 'accepted', now());

      return created_id;
    exception
      when unique_violation then
        created_id := null;
    end;
  end loop;

  raise exception 'Could not create a FarmCrew.';
end;
$$;

revoke all on function public.create_farm_crew(text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_farm_crew(text, text, boolean) to authenticated;

create or replace function public.list_my_farm_crews()
returns table (
  crew_id uuid,
  name text,
  description text,
  crew_code text,
  pet_type text,
  pet_color text,
  member_count integer,
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
    farm_crew.crew_code,
    farm_crew.pet_type,
    farm_crew.pet_color,
    (
      select count(*)::integer
      from public.farm_crew_member counted
      where counted.crew_id = farm_crew.id
        and counted.status = 'accepted'
    ),
    mine.role
  from public.farm_crew_member mine
  join public.farm_crew on farm_crew.id = mine.crew_id
  where mine.user_id = auth.uid()
    and mine.status = 'accepted'
  order by farm_crew.name;
end;
$$;

revoke all on function public.list_my_farm_crews() from public, anon, authenticated;
grant execute on function public.list_my_farm_crews() to authenticated;

create or replace function public.list_public_farm_crews()
returns table (
  crew_id uuid,
  name text,
  description text,
  pet_type text,
  pet_color text,
  member_count integer,
  requested boolean
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
    coalesce(mine.status = 'pending', false)
  from public.farm_crew
  left join public.farm_crew_member mine
    on mine.crew_id = farm_crew.id
    and mine.user_id = auth.uid()
  where farm_crew.is_public
    and coalesce(mine.status, '') is distinct from 'accepted'
  order by farm_crew.name
  limit 40;
end;
$$;

revoke all on function public.list_public_farm_crews() from public, anon, authenticated;
grant execute on function public.list_public_farm_crews() to authenticated;

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
  from public.farm_crew_member owner
  join public.farm_crew on farm_crew.id = owner.crew_id
  join public.farm_crew_member applicant
    on applicant.crew_id = owner.crew_id
    and applicant.status = 'pending'
  join public.profiles on profiles.id = applicant.user_id
  where owner.user_id = auth.uid()
    and owner.role = 'owner'
    and owner.status = 'accepted'
  order by farm_crew.name, profiles.display_name;
end;
$$;

revoke all on function public.list_farm_crew_requests() from public, anon, authenticated;
grant execute on function public.list_farm_crew_requests() to authenticated;

create or replace function public.request_farm_crew_by_code(target_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  found_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  code := upper(trim(coalesce(target_code, '')));
  select id into found_id from public.farm_crew where crew_code = code;
  if found_id is null then
    raise exception 'No FarmCrew uses that code.';
  end if;

  return public.join_farm_crew(found_id, false);
end;
$$;

revoke all on function public.request_farm_crew_by_code(text) from public, anon, authenticated;
grant execute on function public.request_farm_crew_by_code(text) to authenticated;

create or replace function public.request_public_farm_crew(target uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  return public.join_farm_crew(target, true);
end;
$$;

revoke all on function public.request_public_farm_crew(uuid) from public, anon, authenticated;
grant execute on function public.request_public_farm_crew(uuid) to authenticated;

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
      and role = 'owner'
      and status = 'accepted'
  ) then
    raise exception 'You do not lead this FarmCrew.';
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
      and role = 'owner'
      and status = 'accepted'
  ) then
    raise exception 'You do not lead this FarmCrew.';
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

create or replace function public.get_farm_crew(target uuid)
returns table (
  crew_id uuid,
  name text,
  description text,
  pet_type text,
  pet_color text,
  member_count integer
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
    )
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
      or social_profile.allow_status_seen in ('friend_and_group', 'group_only')
    )
  order by profiles.display_name
  limit 30;
end;
$$;

revoke all on function public.list_farm_crew_room(uuid) from public, anon, authenticated;
grant execute on function public.list_farm_crew_room(uuid) to authenticated;
