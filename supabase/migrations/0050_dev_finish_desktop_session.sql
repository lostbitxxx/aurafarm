-- A dev password can finish a desktop pet session from the website with the
-- full planned length, finish bonus, and streak credit. An empty password
-- still leaves that session to the pet.
-- Run this after 0049_room_skin_coins.sql. Safe to run again.

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
  streak_day date;
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

  dev_finish := dev_password = 'emia';
  if session_row.use_desktop_pet and dev_finish is not true then
    raise exception 'The desktop pet finishes this session';
  end if;

  if dev_finish is not true
    and now() + interval '5 seconds' < session_row.started_at + make_interval(secs => session_row.planned_seconds)
  then
    raise exception 'Study time has not finished';
  end if;

  streak_day := case
    when session_row.planned_seconds >= 300 then local_day
    else null
  end;

  perform public.grant_study_experience(
    session_row.id,
    session_row.planned_seconds,
    false,
    0,
    '{}'::text[],
    true,
    streak_day
  );
end;
$$;

revoke all on function public.complete_study_timer(uuid, text, date) from public;
grant execute on function public.complete_study_timer(uuid, text, date) to authenticated;

comment on function public.complete_study_timer(uuid, text, date) is
  'Finishes a website timer, or a desktop pet session when the dev password matches. Grants the full planned length with the finish bonus.';
