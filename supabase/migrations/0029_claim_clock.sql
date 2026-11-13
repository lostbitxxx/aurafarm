-- A desktop pet session is timed from the claim until Finish is clicked.
-- A late finish is cut to the planned length. Distraction seconds stay a
-- separate count, capped at that same length.
-- The website timer still uses started_at.
-- Run this after 0028_distraction_seconds.sql.

alter table public.study_sessions
  add column if not exists distraction_seconds integer
  check (distraction_seconds is null or distraction_seconds >= 0);

drop function if exists public.submit_study_score(uuid, text, integer, integer, text[]);

create or replace function public.submit_study_score(
  target_session_id uuid,
  raw_token text,
  duration_seconds integer,
  blocked_count integer,
  blocked_hosts text[],
  distraction_seconds integer default null
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
  finished boolean;
  studied integer;
  recorded_distraction integer;
begin
  if raw_token is null or raw_token = '' then
    raise exception 'Score rejected';
  end if;
  if duration_seconds is null or duration_seconds < 0 or blocked_count is null or blocked_count < 0 then
    raise exception 'Score rejected';
  end if;
  if distraction_seconds is not null and distraction_seconds < 0 then
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

  if session_row.claimed_at is null then
    raise exception 'Score rejected';
  end if;

  finished := now() + interval '5 seconds' >= session_row.claimed_at + make_interval(secs => session_row.planned_seconds);
  if finished then
    studied := session_row.planned_seconds;
  else
    studied := least(
      session_row.planned_seconds,
      greatest(0, floor(extract(epoch from (now() - session_row.claimed_at)))::integer)
    );
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
    studied,
    result_distracted,
    effective_count,
    filtered,
    finished
  );

  if distraction_seconds is not null then
    recorded_distraction := least(studied, distraction_seconds);
    update public.study_sessions
    set distraction_seconds = recorded_distraction
    where id = session_row.id;
  end if;

  return query select result_xp, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[], integer) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[], integer) to anon, authenticated;

comment on function public.submit_study_score(uuid, text, integer, integer, text[], integer) is
  'Scores a desktop pet session from the claim until Finish. A late finish is cut to the planned length. Distraction seconds are stored separately.';

drop function if exists public.cancel_study_session(uuid);

create or replace function public.cancel_study_session(
  target_session_id uuid,
  distraction_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.study_sessions%rowtype;
  elapsed integer;
  recorded_distraction integer;
  clock_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if distraction_seconds is not null and distraction_seconds < 0 then
    raise exception 'Distraction time rejected';
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

  clock_start := coalesce(session_row.claimed_at, session_row.started_at);
  elapsed := least(
    session_row.planned_seconds,
    greatest(0, floor(extract(epoch from (now() - clock_start)))::integer)
  );
  recorded_distraction := case
    when distraction_seconds is null then null
    else least(elapsed, distraction_seconds)
  end;

  update public.study_sessions
  set status = 'cancelled',
      ended_at = now(),
      duration_seconds = elapsed,
      distraction_seconds = recorded_distraction
  where id = session_row.id;
end;
$$;

revoke all on function public.cancel_study_session(uuid, integer) from public;
grant execute on function public.cancel_study_session(uuid, integer) to authenticated;

comment on function public.cancel_study_session(uuid, integer) is
  'Marks the caller''s active session cancelled. A claimed pet session is measured from the claim and cut to the planned length. Does not change pet experience or level.';

drop function if exists public.claim_study_session(text, text);

create function public.claim_study_session(raw_code text, token_hash text)
returns table (
  session_id uuid,
  pet_type text,
  level integer,
  blocklist text[],
  close_blocked boolean,
  planned_seconds integer,
  started_at timestamptz,
  claimed_at timestamptz
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
  claim_time timestamptz;
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

  claim_time := now();

  update public.study_sessions
  set session_token_hash = claim_study_session.token_hash,
      claimed_at = claim_time
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
  claimed_at := claim_time;
  return next;
end;
$$;

revoke all on function public.claim_study_session(text, text) from public, anon, authenticated;
grant execute on function public.claim_study_session(text, text) to anon;
