-- One experience grant for the website timer and the desktop pet.
-- Run this after 0011_study_timer_xp.sql.

alter table public.study_sessions
  drop constraint if exists study_sessions_planned_seconds_check;

alter table public.study_sessions
  add constraint study_sessions_planned_seconds_check
  check (planned_seconds in (300, 1500, 1800, 3300, 3600, 5100, 5400));

alter table public.study_sessions
  add column if not exists use_desktop_pet boolean not null default false;

alter table public.study_sessions
  add column if not exists xp_awarded integer;

alter table public.study_sessions
  drop constraint if exists study_sessions_xp_awarded_check;

alter table public.study_sessions
  add constraint study_sessions_xp_awarded_check
  check (xp_awarded is null or xp_awarded >= 0);

comment on column public.study_sessions.planned_seconds is
  'Chosen length in seconds. New sessions use 5, 30, 60, or 90 minutes.';

comment on column public.study_sessions.use_desktop_pet is
  'True when the desktop pet tracks the session. The website timer tracks the others.';

comment on column public.study_sessions.xp_awarded is
  'Experience granted to the equipped pet when the session finished.';

-- XP_PER_MINUTE is 2. FINISH_BONUS is 11/10. DISTRACTED_PENALTY is 7/10.
-- Both finish paths call this function, so the rates cannot drift apart.
create or replace function public.grant_study_experience(
  target_session_id uuid,
  studied_seconds integer,
  distracted boolean,
  blocked_count integer,
  blocked_hosts text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  xp_per_minute constant integer := 2;
  finish_bonus constant integer := 11;
  distracted_penalty constant integer := 7;
  session_row public.study_sessions%rowtype;
  recorded integer;
  minutes integer;
  gained integer;
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
  gained := minutes * xp_per_minute * finish_bonus / 10;
  if distracted then
    gained := gained * distracted_penalty / 10;
  end if;

  if session_row.pet_id is null then
    gained := 0;
  else
    update public.user_pets
    set xp = user_pets.xp + gained,
        level = 1 + ((user_pets.xp + gained) / 100)
    where id = session_row.pet_id
      and user_id = session_row.user_id;
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

revoke all on function public.grant_study_experience(uuid, integer, boolean, integer, text[]) from public, anon, authenticated;

drop function if exists public.submit_study_score(uuid, text, integer, integer, text[]);

create function public.submit_study_score(
  target_session_id uuid,
  raw_token text,
  duration_seconds integer,
  blocked_count integer,
  blocked_hosts text[]
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
    filtered
  );

  return query select result_xp, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[]) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[]) to anon, authenticated;

create or replace function public.complete_study_timer(
  target_session_id uuid,
  dev_password text
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
    '{}'::text[]
  );
end;
$$;

revoke all on function public.complete_study_timer(uuid, text) from public;
grant execute on function public.complete_study_timer(uuid, text) to authenticated;

drop function if exists public.cancel_study_session(uuid);

revoke update on table public.study_sessions from authenticated;

drop policy if exists "study_sessions_update_cancel_own" on public.study_sessions;

drop table if exists public.study_scores;

create or replace function public.purchase_pet(target_pet_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_pet_type is null or target_pet_type not in ('lantern_moth', 'river_newt') then
    raise exception 'Pet not for sale';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
  ) then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1
    from public.user_pets
    where user_id = auth.uid()
      and pet_type = target_pet_type
  ) then
    raise exception 'Pet already owned';
  end if;

  insert into public.user_pets (user_id, pet_type, level, is_desktop_active)
  values (auth.uid(), target_pet_type, 1, false);
end;
$$;

revoke all on function public.purchase_pet(text) from public, anon, authenticated;
grant execute on function public.purchase_pet(text) to authenticated;

alter table public.profiles
  drop constraint if exists profiles_points_nonnegative;

alter table public.profiles
  drop column if exists points;

drop function if exists public.claim_study_session(text, text);

create function public.claim_study_session(raw_code text, token_hash text)
returns table (
  session_id uuid,
  pet_type text,
  level integer,
  blocklist text[],
  close_blocked boolean,
  planned_seconds integer,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  code_hash text;
  session_row public.study_sessions%rowtype;
  equipped_type text;
  equipped_level integer;
  hosts text[];
  close_flag boolean;
begin
  if raw_code is null or raw_code = '' or token_hash is null or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Claim rejected';
  end if;

  code_hash := encode(extensions.digest(raw_code, 'sha256'), 'hex');

  select * into session_row
  from public.study_sessions
  where launch_code_hash = code_hash
    and status = 'active'
    and claimed_at is null
    and launch_code_expires_at > now()
    and use_desktop_pet
  order by started_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Claim rejected';
  end if;

  update public.study_sessions
  set session_token_hash = claim_study_session.token_hash,
      claimed_at = now()
  where id = session_row.id;

  select user_pets.pet_type, user_pets.level
  into equipped_type, equipped_level
  from public.user_pets
  where user_id = session_row.user_id
    and is_desktop_active
  limit 1;

  select coalesce(array_agg(blocklist_hosts.host order by blocklist_hosts.host), '{}')
  into hosts
  from public.blocklist_hosts;

  select profiles.close_blocked
  into close_flag
  from public.profiles
  where id = session_row.user_id;

  session_id := session_row.id;
  pet_type := coalesce(equipped_type, 'baby_slime');
  level := coalesce(equipped_level, 1);
  blocklist := hosts;
  close_blocked := coalesce(close_flag, false);
  planned_seconds := session_row.planned_seconds;
  started_at := session_row.started_at;
  return next;
end;
$$;

revoke all on function public.claim_study_session(text, text) from public, anon, authenticated;
grant execute on function public.claim_study_session(text, text) to anon;
