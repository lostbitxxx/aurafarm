-- Add a finished study score to the spendable balance.
-- Run this after 0008_pet_shop.sql.

comment on column public.profiles.points is
  'Spendable balance. A finished study session adds 100 when focused and 40 when distracted.';

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

  update public.profiles
  set points = points + result_points
  where id = session_row.user_id;

  return query select result_points, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[]) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[]) to anon, authenticated;
