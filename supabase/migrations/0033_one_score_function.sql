-- 0031 added a 5-argument submit_study_score beside the streak function,
-- which already has local_day date default null. A pet Finish call matches
-- both, so PostgREST rejects it. One function remains.
-- A full session still gets the 1.1 finish bonus. An earlier Finish counts
-- whole minutes and does not move the streak.
-- Run this after 0032_pet_finish_minutes.sql. Safe to run again.

drop function if exists public.submit_study_score(uuid, text, integer, integer, text[]);

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
  finished boolean;
  studied integer;
  streak_day date;
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
  streak_day := case
    when finished and session_row.planned_seconds >= 300 then local_day
    else null
  end;
  result_xp := public.grant_study_experience(
    target_session_id,
    studied,
    result_distracted,
    effective_count,
    filtered,
    finished,
    streak_day
  );

  return query select result_xp, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[], date) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[], date) to anon, authenticated;

comment on function public.submit_study_score(uuid, text, integer, integer, text[], date) is
  'Scores a desktop pet Finish click from started_at. A full session gets the 1.1 finish bonus and may count a streak day. An earlier click counts whole minutes only.';

notify pgrst, 'reload schema';
