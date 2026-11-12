-- A study length can be any whole minute from 1 to 240.
-- Run this after 0016_admin_reset_own.sql.

alter table public.study_sessions
  drop constraint if exists study_sessions_planned_seconds_check;

alter table public.study_sessions
  add constraint study_sessions_planned_seconds_check
  check (
    planned_seconds >= 60
    and planned_seconds <= 14400
    and planned_seconds % 60 = 0
  );

comment on column public.study_sessions.planned_seconds is
  'Chosen length in seconds. Any whole minute from 1 to 240.';
