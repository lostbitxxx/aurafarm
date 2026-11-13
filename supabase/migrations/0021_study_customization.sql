-- Study mode onboarding: behavior answers, mode, and monthly/daily goals.
-- Run this after 0020_collection_clothes.sql.

alter table public.profiles
  add column if not exists study_mode text;

alter table public.profiles
  add column if not exists preferred_session_minutes integer;

alter table public.profiles
  add column if not exists monthly_session_goal integer;

alter table public.profiles
  add column if not exists daily_session_goal integer;

alter table public.profiles
  add column if not exists study_days_per_week integer;

alter table public.profiles
  add column if not exists behavior_answers jsonb;

alter table public.profiles
  add column if not exists customization_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_study_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_study_mode_check
      check (study_mode is null or study_mode in ('assassin', 'knight', 'lord'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_preferred_session_minutes_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_session_minutes_check
      check (
        preferred_session_minutes is null
        or preferred_session_minutes in (30, 60, 90)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_monthly_session_goal_check'
  ) then
    alter table public.profiles
      add constraint profiles_monthly_session_goal_check
      check (
        monthly_session_goal is null
        or (monthly_session_goal >= 1 and monthly_session_goal <= 120)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_daily_session_goal_check'
  ) then
    alter table public.profiles
      add constraint profiles_daily_session_goal_check
      check (
        daily_session_goal is null
        or (daily_session_goal >= 1 and daily_session_goal <= 12)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_study_days_per_week_check'
  ) then
    alter table public.profiles
      add constraint profiles_study_days_per_week_check
      check (
        study_days_per_week is null
        or (study_days_per_week >= 1 and study_days_per_week <= 7)
      );
  end if;
end
$$;

comment on column public.profiles.study_mode is
  'Chosen study mode: assassin, knight, or lord.';
comment on column public.profiles.preferred_session_minutes is
  'Default study block length for the chosen study mode.';
comment on column public.profiles.monthly_session_goal is
  'How many study blocks the farmer aims to finish this month.';
comment on column public.profiles.daily_session_goal is
  'Daily slice of the monthly goal on a study day.';
comment on column public.profiles.study_days_per_week is
  'How many days each week the farmer plans to study.';
comment on column public.profiles.behavior_answers is
  'Answers from the three onboarding behavior questions.';
comment on column public.profiles.customization_completed_at is
  'When the farmer finished study-mode onboarding. Null means still needed.';
