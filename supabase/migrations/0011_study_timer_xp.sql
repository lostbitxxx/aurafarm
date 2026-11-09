-- Study countdown length, the pet that was equipped at the start, and
-- experience from finished minutes. Run this after 0010_score_wallet_points.sql.

alter table public.study_sessions
  add column if not exists planned_seconds integer not null default 300;

alter table public.study_sessions
  drop constraint if exists study_sessions_planned_seconds_check;

alter table public.study_sessions
  add constraint study_sessions_planned_seconds_check
  check (planned_seconds in (300, 1500, 3300, 5100));

alter table public.study_sessions
  add column if not exists pet_id uuid references public.user_pets (id) on delete set null;

alter table public.user_pets
  add column if not exists xp integer not null default 0;

alter table public.user_pets
  drop constraint if exists user_pets_xp_check;

alter table public.user_pets
  add constraint user_pets_xp_check check (xp >= 0);

comment on column public.study_sessions.planned_seconds is
  'Chosen countdown length in seconds: 5, 25, 55, or 85 minutes.';

comment on column public.study_sessions.pet_id is
  'Pet equipped when the session started. Only that pet gains experience.';

comment on column public.user_pets.xp is
  'Experience from finished study minutes. One level is 100 points.';

-- Whole minutes of study become experience on one owned pet.
-- Level is 1 plus xp divided by 100. A short minute adds nothing.
create or replace function public.apply_study_experience(
  target_user_id uuid,
  target_pet_id uuid,
  studied_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gained integer;
begin
  if target_user_id is null or target_pet_id is null or studied_seconds is null or studied_seconds < 60 then
    return;
  end if;

  gained := studied_seconds / 60;

  update public.user_pets
  set xp = user_pets.xp + gained,
      level = 1 + ((user_pets.xp + gained) / 100)
  where id = target_pet_id
    and user_id = target_user_id;
end;
$$;

revoke all on function public.apply_study_experience(uuid, uuid, integer) from public, anon, authenticated;

create or replace function public.submit_study_score(
  target_session_id uuid,
  raw_token text,
  duration_seconds integer,
  blocked_count integer,
  blocked_hosts text[]
)
returns table (points integer, distracted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  session_row public.study_sessions%rowtype;
  filtered text[];
  effective_count integer;
  result_points integer;
  result_distracted boolean;
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

  if session_row.status <> 'active' then
    raise exception 'Score rejected';
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
  result_points := case when result_distracted then 40 else 100 end;

  update public.study_sessions
  set status = 'submitted',
      ended_at = now(),
      duration_seconds = submit_study_score.duration_seconds,
      blocked_count = effective_count,
      blocked_hosts = filtered
  where id = target_session_id;

  insert into public.study_scores (
    session_id,
    user_id,
    points,
    distracted,
    duration_seconds,
    blocked_count,
    blocked_hosts
  )
  values (
    target_session_id,
    session_row.user_id,
    result_points,
    result_distracted,
    submit_study_score.duration_seconds,
    effective_count,
    filtered
  );

  update public.profiles as farmer
  set points = farmer.points + result_points
  where farmer.id = session_row.user_id;

  perform public.apply_study_experience(
    session_row.user_id,
    session_row.pet_id,
    submit_study_score.duration_seconds
  );

  return query select result_points, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[]) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[]) to anon, authenticated;

-- Runs as the owner so the cancel guard can store the focused seconds.
-- Authenticated updates may only flip status to cancelled.
drop function if exists public.cancel_study_session(uuid);

create function public.cancel_study_session(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.study_sessions%rowtype;
  focused integer;
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

  focused := least(
    session_row.planned_seconds,
    greatest(0, floor(extract(epoch from (now() - session_row.started_at)))::integer)
  );

  update public.study_sessions
  set status = 'cancelled',
      ended_at = now(),
      duration_seconds = focused
  where id = session_row.id;

  perform public.apply_study_experience(session_row.user_id, session_row.pet_id, focused);
end;
$$;

revoke all on function public.cancel_study_session(uuid) from public;
grant execute on function public.cancel_study_session(uuid) to authenticated;

-- A normal finish waits until the chosen length has elapsed.
-- The dev password skips that wait and still records the full length.
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

  if not found then
    raise exception 'Session not found';
  end if;

  if session_row.status <> 'active' then
    return;
  end if;

  dev_finish := dev_password = 'emia';
  if dev_finish is not true
    and now() + interval '5 seconds' < session_row.started_at + make_interval(secs => session_row.planned_seconds)
  then
    raise exception 'Study time has not finished';
  end if;

  update public.study_sessions
  set status = 'submitted',
      ended_at = now(),
      duration_seconds = session_row.planned_seconds
  where id = session_row.id;

  perform public.apply_study_experience(
    session_row.user_id,
    session_row.pet_id,
    session_row.planned_seconds
  );
end;
$$;

revoke all on function public.complete_study_timer(uuid, text) from public;
grant execute on function public.complete_study_timer(uuid, text) to authenticated;
