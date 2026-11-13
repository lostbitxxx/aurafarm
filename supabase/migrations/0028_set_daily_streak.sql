-- Dev helper: set the signed-in farmer's streak for testing.
-- Run this after 0027_daily_streak.sql.

create or replace function public.set_daily_streak(
  dev_password text,
  target_count integer,
  local_day date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  farmer uuid;
  next_count integer;
begin
  if dev_password is distinct from 'emia' then
    raise exception 'That password does not match';
  end if;

  farmer := auth.uid();
  if farmer is null then
    raise exception 'Not authenticated';
  end if;

  if target_count is null or target_count < 0 or target_count > 10000 then
    raise exception 'Streak count must be from 0 to 10000';
  end if;

  if local_day is null then
    raise exception 'Streak day is required';
  end if;

  if local_day < (current_date - 1) or local_day > (current_date + 1) then
    raise exception 'Streak day is out of range';
  end if;

  next_count := target_count;

  update public.profiles
  set streak_count = next_count,
      streak_local_date = case when next_count = 0 then null else local_day end
  where id = farmer;

  return next_count;
end;
$$;

revoke all on function public.set_daily_streak(text, integer, date) from public, anon;
grant execute on function public.set_daily_streak(text, integer, date) to authenticated;

comment on function public.set_daily_streak(text, integer, date) is
  'Dev-only: sets the signed-in farmer streak count and marks today as the last streak day.';
