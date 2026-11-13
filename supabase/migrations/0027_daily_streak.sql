-- Daily streak: one full finish per local calendar day. Early ends do not count.
-- Full finishes with a local day get +10% XP after the finish bonus.
-- Run this after 0026_apply_accessory_rewards.sql.

alter table public.profiles
  add column if not exists streak_count integer not null default 0;

alter table public.profiles
  add column if not exists streak_local_date date;

alter table public.profiles
  drop constraint if exists profiles_streak_count_check;

alter table public.profiles
  add constraint profiles_streak_count_check
  check (streak_count >= 0);

comment on column public.profiles.streak_count is
  'Consecutive local days with at least one full study finish.';

comment on column public.profiles.streak_local_date is
  'Farmer-local calendar day of the last streak-qualifying finish.';

create or replace function public.touch_daily_streak(
  target_user_id uuid,
  local_day date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  next_count integer;
begin
  if target_user_id is null or local_day is null then
    raise exception 'Streak day is required';
  end if;

  if local_day < (current_date - 1) or local_day > (current_date + 1) then
    raise exception 'Streak day is out of range';
  end if;

  select * into profile_row
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if profile_row.streak_local_date = local_day then
    return profile_row.streak_count;
  end if;

  if profile_row.streak_local_date = (local_day - 1) then
    next_count := profile_row.streak_count + 1;
  else
    next_count := 1;
  end if;

  update public.profiles
  set streak_count = next_count,
      streak_local_date = local_day
  where id = target_user_id;

  return next_count;
end;
$$;

revoke all on function public.touch_daily_streak(uuid, date) from public, anon, authenticated;

comment on function public.touch_daily_streak(uuid, date) is
  'Advances or resets the farmer streak for one local calendar day. Same-day repeats keep the count.';

drop function if exists public.grant_study_experience(uuid, integer, boolean, integer, text[], boolean);
drop function if exists public.grant_study_experience(uuid, integer, boolean, integer, text[], boolean, date);

create or replace function public.grant_study_experience(
  target_session_id uuid,
  studied_seconds integer,
  distracted boolean,
  blocked_count integer,
  blocked_hosts text[],
  apply_finish_bonus boolean,
  local_day date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  xp_per_minute constant integer := 2;
  finish_bonus constant integer := 11;
  streak_bonus constant integer := 11;
  distracted_penalty constant integer := 7;
  session_row public.study_sessions%rowtype;
  recorded integer;
  minutes integer;
  gained integer;
  previous_xp integer;
  previous_level integer;
  next_level integer;
  level_step integer;
  open_slots integer;
  catalog_count integer;
  owned_count integer;
  pending_count integer;
  inserted_count integer;
  pet_found boolean;
  streak_days integer;
begin
  select * into session_row
  from public.study_sessions
  where id = target_session_id
  for update;

  if not found or session_row.status <> 'active' then
    return 0;
  end if;

  recorded := least(
    session_row.planned_seconds,
    greatest(0, coalesce(studied_seconds, 0))
  );
  minutes := recorded / 60;
  gained := minutes * xp_per_minute;
  if apply_finish_bonus then
    gained := gained * finish_bonus / 10;
    if local_day is not null then
      streak_days := public.touch_daily_streak(session_row.user_id, local_day);
      if streak_days >= 1 then
        gained := gained * streak_bonus / 10;
      end if;
    end if;
  end if;
  if distracted then
    gained := gained * distracted_penalty / 10;
  end if;

  if session_row.pet_id is null then
    gained := 0;
  else
    select xp into previous_xp
    from public.user_pets
    where id = session_row.pet_id
      and user_id = session_row.user_id
    for update;

    pet_found := found;
    if pet_found then
      previous_level := 1 + (previous_xp / 100);
    end if;

    update public.user_pets
    set xp = user_pets.xp + gained,
        level = 1 + ((user_pets.xp + gained) / 100)
    where id = session_row.pet_id
      and user_id = session_row.user_id
    returning level into next_level;

    if pet_found and next_level > previous_level then
      perform pg_advisory_xact_lock(hashtextextended(session_row.user_id::text, 0));

      select count(*) into catalog_count from public.collection_items;
      select count(*) into owned_count
      from public.user_collections
      where user_id = session_row.user_id;
      select count(*) into pending_count
      from public.collection_rewards
      where user_id = session_row.user_id
        and item_id is null;

      open_slots := greatest(0, catalog_count - owned_count - pending_count);

      for level_step in (previous_level + 1)..next_level loop
        exit when open_slots <= 0;
        insert into public.collection_rewards (user_id, pet_id, level_reached)
        values (session_row.user_id, session_row.pet_id, level_step)
        on conflict (user_id, pet_id, level_reached) do nothing;
        get diagnostics inserted_count = row_count;
        if inserted_count > 0 then
          open_slots := open_slots - 1;
        end if;
      end loop;
    end if;
  end if;

  update public.study_sessions
  set status = 'submitted',
      ended_at = now(),
      duration_seconds = recorded,
      blocked_count = greatest(0, coalesce(grant_study_experience.blocked_count, 0)),
      blocked_hosts = coalesce(grant_study_experience.blocked_hosts, '{}'),
      xp_awarded = gained
  where id = session_row.id;

  return gained;
end;
$$;

revoke all on function public.grant_study_experience(uuid, integer, boolean, integer, text[], boolean, date) from public, anon, authenticated;

drop function if exists public.submit_study_score(uuid, text, integer, integer, text[]);
drop function if exists public.submit_study_score(uuid, text, integer, integer, text[], date);

create or replace function public.submit_study_score(
  target_session_id uuid,
  raw_token text,
  duration_seconds integer,
  blocked_count integer,
  blocked_hosts text[],
  local_day date default null
)
returns table (xp integer, distracted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  session_row public.study_sessions%rowtype;
  filtered text[];
  effective_count integer;
  result_distracted boolean;
  result_xp integer;
begin
  if raw_token is null or raw_token = '' then
    raise exception 'Score rejected';
  end if;
  if duration_seconds is null or duration_seconds < 0 or blocked_count is null or blocked_count < 0 then
    raise exception 'Score rejected';
  end if;

  token_hash := encode(extensions.digest(raw_token, 'sha256'), 'hex');

  select * into session_row
  from public.study_sessions
  where id = target_session_id
  for update;

  if not found
    or session_row.session_token_hash is null
    or session_row.session_token_hash <> token_hash then
    raise exception 'Score rejected';
  end if;

  if session_row.status = 'submitted' then
    raise exception 'Score already submitted';
  end if;

  if session_row.status <> 'active' or session_row.use_desktop_pet is not true then
    raise exception 'The website timer finishes this session';
  end if;

  if now() + interval '5 seconds' < session_row.started_at + make_interval(secs => session_row.planned_seconds) then
    raise exception 'Study time has not finished';
  end if;

  select coalesce(array_agg(distinct lower(candidate)), '{}')
  into filtered
  from unnest(coalesce(blocked_hosts, '{}'::text[])) as candidate
  where candidate is not null
    and candidate <> ''
    and exists (
      select 1
      from public.blocklist_hosts listed
      where lower(candidate) = listed.host
        or (
          length(lower(candidate)) > length(listed.host) + 1
          and right(lower(candidate), length(listed.host) + 1) = '.' || listed.host
        )
    );

  effective_count := greatest(blocked_count, coalesce(array_length(filtered, 1), 0));
  result_distracted := effective_count > 0;
  result_xp := public.grant_study_experience(
    target_session_id,
    session_row.planned_seconds,
    result_distracted,
    effective_count,
    filtered,
    true,
    local_day
  );

  return query select result_xp, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[], date) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[], date) to anon, authenticated;

drop function if exists public.complete_study_timer(uuid, text);
drop function if exists public.complete_study_timer(uuid, text, date);

create or replace function public.complete_study_timer(
  target_session_id uuid,
  dev_password text,
  local_day date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.study_sessions%rowtype;
  dev_finish boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into session_row
  from public.study_sessions
  where id = target_session_id
    and user_id = auth.uid()
  for update;

  if not found or session_row.status <> 'active' then
    return;
  end if;

  if session_row.use_desktop_pet then
    raise exception 'The desktop pet finishes this session';
  end if;

  dev_finish := dev_password = 'emia';
  if dev_finish is not true
    and now() + interval '5 seconds' < session_row.started_at + make_interval(secs => session_row.planned_seconds)
  then
    raise exception 'Study time has not finished';
  end if;

  perform public.grant_study_experience(
    session_row.id,
    session_row.planned_seconds,
    false,
    0,
    '{}'::text[],
    true,
    local_day
  );
end;
$$;

revoke all on function public.complete_study_timer(uuid, text, date) from public;
grant execute on function public.complete_study_timer(uuid, text, date) to authenticated;

create or replace function public.reset_study_world(dev_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  farmer uuid;
begin
  if dev_password is distinct from 'emia' then
    raise exception 'That password does not match';
  end if;

  farmer := auth.uid();
  if farmer is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.study_scores') is not null then
    execute 'delete from public.study_scores where user_id = $1' using farmer;
  end if;

  delete from public.study_sessions
  where user_id = farmer;

  delete from public.collection_rewards
  where user_id = farmer;

  delete from public.user_collections
  where user_id = farmer;

  update public.user_pets
  set xp = 0,
      level = 1,
      color = null,
      hat = null,
      clothes = null
  where user_id = farmer;

  update public.profiles
  set streak_count = 0,
      streak_local_date = null
  where id = farmer;
end;
$$;

revoke all on function public.reset_study_world(text) from public, anon;
grant execute on function public.reset_study_world(text) to authenticated;

comment on function public.reset_study_world(text) is
  'Sets the signed-in farmer''s pets to level 1 and 0 experience, clears worn colors, hats, clothes, and streak, and deletes that farmer''s study sessions, collection, and unspent rewards.';
