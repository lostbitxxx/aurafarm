-- Stores how long the front tab stayed on a blocklist host.
-- Focus time on the history card is duration_seconds minus this value.
-- Null means the pet did not record the interval.
-- Run this after 0027_pet_finish_partial.sql.

alter table public.study_sessions
  add column if not exists distraction_seconds integer
  check (distraction_seconds is null or distraction_seconds >= 0);

comment on column public.study_sessions.distraction_seconds is
  'Seconds the front tab spent on a blocklist host. Null when that interval was not recorded.';

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
    or new.distraction_seconds is distinct from old.distraction_seconds
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

  finished := now() + interval '5 seconds' >= session_row.started_at + make_interval(secs => session_row.planned_seconds);
  if finished then
    studied := session_row.planned_seconds;
  else
    studied := least(
      session_row.planned_seconds,
      greatest(0, floor(extract(epoch from (now() - session_row.started_at)))::integer)
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
  'Scores a desktop pet session and stores blocklist seconds when the pet sends them.';

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

  elapsed := least(
    session_row.planned_seconds,
    greatest(0, floor(extract(epoch from (now() - session_row.started_at)))::integer)
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
  'Marks the caller''s active session cancelled. Stores blocklist seconds when the pet sends them. Does not change pet experience or level.';
