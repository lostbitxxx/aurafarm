-- Friend leaderboards. Run this after 0026_social_status.sql.
-- Study totals match the desk: submitted and cancelled sessions that have a duration.
-- Month and week use Asia/Hong_Kong. Weeks start on Monday.
-- Pet levels are the sum of user_pets.level for every pet that farmer owns.
-- The signed-in farmer is included with their accepted friends.

create or replace function public.list_friend_leaderboard(board text)
returns table (
  farmer_id uuid,
  display_name text,
  score bigint,
  place integer
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  month_start timestamptz;
  week_start timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;

  if board is null or board not in ('all_time', 'month', 'week', 'pet_levels') then
    raise exception 'Choose a leaderboard';
  end if;

  month_start := date_trunc('month', timezone('Asia/Hong_Kong', now())) at time zone 'Asia/Hong_Kong';
  week_start := date_trunc('week', timezone('Asia/Hong_Kong', now())) at time zone 'Asia/Hong_Kong';

  return query
  with people as (
    select auth.uid() as farmer_id
    union
    select case
      when friendship.user_a = auth.uid() then friendship.user_b
      else friendship.user_a
    end
    from public.friendship
    where friendship.status = 'accepted'
      and (friendship.user_a = auth.uid() or friendship.user_b = auth.uid())
  ),
  scored as (
    select
      people.farmer_id,
      coalesce(nullif(trim(profiles.display_name), ''), 'Farmer') as display_name,
      case
        when board = 'pet_levels' then coalesce((
          select sum(user_pets.level)::bigint
          from public.user_pets
          where user_pets.user_id = people.farmer_id
        ), 0)
        else coalesce((
          select sum(study_sessions.duration_seconds)::bigint
          from public.study_sessions
          where study_sessions.user_id = people.farmer_id
            and study_sessions.status in ('submitted', 'cancelled')
            and study_sessions.duration_seconds is not null
            and (
              board = 'all_time'
              or (board = 'month' and study_sessions.ended_at >= month_start)
              or (board = 'week' and study_sessions.ended_at >= week_start)
            )
        ), 0)
      end as score
    from people
    join public.profiles on profiles.id = people.farmer_id
  )
  select
    scored.farmer_id,
    scored.display_name,
    scored.score,
    rank() over (order by scored.score desc)::integer
  from scored
  order by 4, scored.display_name;
end;
$$;

revoke all on function public.list_friend_leaderboard(text) from public, anon, authenticated;
grant execute on function public.list_friend_leaderboard(text) to authenticated;
