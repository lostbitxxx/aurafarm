-- Weekly study plan: which weekdays to study (Mon=1 … Sun=7).
-- preferred_session_minutes is the daily minutes goal on those days.
-- Run after 0043_farm_crew_roster.sql.

alter table public.profiles
  add column if not exists weekly_study_days integer[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_weekly_study_days_check'
  ) then
    alter table public.profiles
      add constraint profiles_weekly_study_days_check
      check (
        weekly_study_days is null
        or (
          cardinality(weekly_study_days) >= 1
          and cardinality(weekly_study_days) <= 7
          and weekly_study_days <@ array[1, 2, 3, 4, 5, 6, 7]
        )
      );
  end if;
end
$$;

comment on column public.profiles.weekly_study_days is
  'ISO weekdays the farmer plans to study (1=Mon … 7=Sun). Rest days may still earn streak credit when the daily minutes goal is met.';
comment on column public.profiles.preferred_session_minutes is
  'Daily study minutes goal on a selected weekday (30, 60, or 90). Seeded from study mode.';

-- Backfill from lifestyle when possible; otherwise from study_days_per_week.
update public.profiles
set weekly_study_days = case
  when behavior_answers->>'lifestyle' = 'few' then array[1, 3, 5]
  when behavior_answers->>'lifestyle' = 'daily' then array[1, 2, 3, 4, 5, 6, 7]
  when behavior_answers->>'lifestyle' = 'steady' then array[1, 2, 3, 4, 5]
  when study_days_per_week <= 3 then array[1, 3, 5]
  when study_days_per_week >= 6 then array[1, 2, 3, 4, 5, 6, 7]
  else array[1, 2, 3, 4, 5]
end
where customization_completed_at is not null
  and weekly_study_days is null;

update public.profiles
set study_days_per_week = cardinality(weekly_study_days)
where weekly_study_days is not null
  and (
    study_days_per_week is null
    or study_days_per_week <> cardinality(weekly_study_days)
  );

-- Client can save the new column (0022 grant plus this one).
grant update (
  study_mode,
  preferred_session_minutes,
  monthly_session_goal,
  daily_session_goal,
  study_days_per_week,
  weekly_study_days,
  behavior_answers,
  customization_completed_at
) on table public.profiles to authenticated;
