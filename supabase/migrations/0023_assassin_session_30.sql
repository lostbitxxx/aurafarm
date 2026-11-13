-- Assassin study blocks are 30 minutes (was 15).
-- Run this after 0022_study_customization_grant.sql.

alter table public.profiles
  drop constraint if exists profiles_preferred_session_minutes_check;

alter table public.profiles
  add constraint profiles_preferred_session_minutes_check
  check (
    preferred_session_minutes is null
    or preferred_session_minutes in (30, 60, 90)
  );

update public.profiles
set preferred_session_minutes = 30
where study_mode = 'assassin'
  and preferred_session_minutes = 15;
