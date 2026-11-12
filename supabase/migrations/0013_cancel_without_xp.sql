-- Cancel stops an active session. It does not grant experience or change a pet level.
-- Run this after 0012_session_xp.sql.

create or replace function public.cancel_study_session(target_session_id uuid)
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
  'Marks the caller''s active session cancelled. Does not change pet experience or level.';
