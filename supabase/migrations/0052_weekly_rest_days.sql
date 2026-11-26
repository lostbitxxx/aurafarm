-- Weekly rest days for each farmer.
-- weekly_study_days and weekly_rest_days together name every ISO weekday
-- (1 = Monday … 7 = Sunday) exactly once, with at least one study day.
-- Run after 0051_block_bilibili.sql.

create or replace function public.weekly_study_rest_partition(
  study_days integer[],
  rest_days integer[]
)
returns boolean
language sql
immutable
parallel safe
as $$
  select
    study_days is not null
    and rest_days is not null
    and study_days <@ array[1, 2, 3, 4, 5, 6, 7]::integer[]
    and rest_days <@ array[1, 2, 3, 4, 5, 6, 7]::integer[]
    and cardinality(study_days) between 1 and 7
    and cardinality(rest_days) between 0 and 6
    and cardinality(study_days) = (select count(distinct day) from unnest(study_days) as day)
    and cardinality(rest_days) = (select count(distinct day) from unnest(rest_days) as day)
    and not (study_days && rest_days)
    and cardinality(study_days) + cardinality(rest_days) = 7
    and array[1, 2, 3, 4, 5, 6, 7]::integer[] <@ (study_days || rest_days);
$$;

comment on function public.weekly_study_rest_partition(integer[], integer[]) is
  'True when study days and rest days are unique, disjoint, and cover Monday through Sunday, with at least one study day.';

alter table public.profiles
  add column if not exists weekly_rest_days integer[];

comment on column public.profiles.weekly_rest_days is
  'ISO weekdays the farmer marked as rest (1=Mon … 7=Sun). With weekly_study_days, every weekday is either study or rest.';

-- Both assignments read the original study days. Duplicates collapse to one weekday.
update public.profiles
set
  weekly_study_days = (
    select coalesce(array_agg(day order by day), '{}'::integer[])
    from unnest(array[1, 2, 3, 4, 5, 6, 7]::integer[]) as day
    where day = any(weekly_study_days)
  ),
  weekly_rest_days = (
    select coalesce(array_agg(day order by day), '{}'::integer[])
    from unnest(array[1, 2, 3, 4, 5, 6, 7]::integer[]) as day
    where not (day = any(weekly_study_days))
  )
where weekly_study_days is not null
  and weekly_rest_days is null;

update public.profiles
set study_days_per_week = cardinality(weekly_study_days)
where weekly_study_days is not null
  and (
    study_days_per_week is null
    or study_days_per_week <> cardinality(weekly_study_days)
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_weekly_rest_days_check'
  ) then
    alter table public.profiles
      add constraint profiles_weekly_rest_days_check
      check (
        weekly_rest_days is null
        or public.weekly_study_rest_partition(weekly_study_days, weekly_rest_days)
      );
  end if;
end
$$;

grant update (weekly_rest_days) on table public.profiles to authenticated;
