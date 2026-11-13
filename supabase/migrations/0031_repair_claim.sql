-- Restores the desktop claim after 0029 and 0030.
-- Those versions added claimed_at to claim_study_session's result.
-- claimed_at is already a column, so "claimed_at is null" aborts with
-- "column reference claimed_at is ambiguous". The claim route shows that
-- as Claim rejected. The row is not updated, so the code is not used up.
-- This also drops distraction time and the claim-clock score and cancel
-- functions. Profiles, pets, sessions, and experience stay.
-- Run this whole file in the Supabase SQL editor. Safe to run again.

create or replace function public.guard_study_session_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.id is distinct from old.id
    or new.session_token_hash is distinct from old.session_token_hash
    or new.launch_code_hash is distinct from old.launch_code_hash
    or new.launch_code_expires_at is distinct from old.launch_code_expires_at
    or new.claimed_at is distinct from old.claimed_at
    or new.blocked_count is distinct from old.blocked_count
    or new.blocked_hosts is distinct from old.blocked_hosts
    or new.duration_seconds is distinct from old.duration_seconds
    or new.started_at is distinct from old.started_at
    or new.created_at is distinct from old.created_at
    or old.status is distinct from 'active'
    or new.status is distinct from 'cancelled'
  then
    raise exception 'Only an active session can be cancelled';
  end if;

  new.ended_at := now();
  return new;
end;
$$;

drop function if exists public.submit_study_score(uuid, text, integer, integer, text[], integer);
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
    filtered,
    true
  );

  return query select result_xp, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[]) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[]) to anon, authenticated;

comment on function public.submit_study_score(uuid, text, integer, integer, text[]) is
  'Scores a finished desktop pet session from started_at. Does not store distraction time.';

drop function if exists public.cancel_study_session(uuid, integer);
drop function if exists public.cancel_study_session(uuid);

create function public.cancel_study_session(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.study_sessions%rowtype;
  elapsed integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into session_row
  from public.study_sessions
  where id = target_session_id
    and user_id = auth.uid()
    and status = 'active'
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  elapsed := least(
    session_row.planned_seconds,
    greatest(0, floor(extract(epoch from (now() - session_row.started_at)))::integer)
  );

  update public.study_sessions
  set status = 'cancelled',
      ended_at = now(),
      duration_seconds = elapsed
  where id = session_row.id;
end;
$$;

revoke all on function public.cancel_study_session(uuid) from public;
grant execute on function public.cancel_study_session(uuid) to authenticated;

comment on function public.cancel_study_session(uuid) is
  'Marks the caller''s active session cancelled. Measured from started_at. Does not change pet experience or level.';

alter table public.study_sessions
  drop column if exists distraction_seconds;

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
  from public.study_sessions as session
  where session.launch_code_hash = code_hash
    and session.status = 'active'
    and session.claimed_at is null
    and session.launch_code_expires_at > now()
    and session.use_desktop_pet is true
  order by session.started_at desc
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

comment on function public.claim_study_session(text, text) is
  'Claims an active desktop session. claimed_at stays a column only, so the lookup is not ambiguous.';

notify pgrst, 'reload schema';
