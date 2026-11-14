-- Global leaderboard. Run this after 0036_remove_unused_accessories.sql.
-- Same scores as the friend board: submitted and cancelled sessions with a duration,
-- month and week in Asia/Hong_Kong (weeks start Monday), or the sum of pet levels.
-- Returns the top 20 farmers. Ties share a rank.

create or replace function public.list_global_leaderboard(board text)
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
  with scored as (
    select
      profiles.id as farmer_id,
      coalesce(nullif(trim(profiles.display_name), ''), 'Farmer') as display_name,
      case
        when board = 'pet_levels' then coalesce((
          select sum(user_pets.level)::bigint
          from public.user_pets
          where user_pets.user_id = profiles.id
        ), 0)
        else coalesce((
          select sum(study_sessions.duration_seconds)::bigint
          from public.study_sessions
          where study_sessions.user_id = profiles.id
            and study_sessions.status in ('submitted', 'cancelled')
            and study_sessions.duration_seconds is not null
            and (
              board = 'all_time'
              or (board = 'month' and study_sessions.ended_at >= month_start)
              or (board = 'week' and study_sessions.ended_at >= week_start)
            )
        ), 0)
      end as score
    from public.profiles
  ),
  ranked as (
    select
      scored.farmer_id,
      scored.display_name,
      scored.score,
      rank() over (order by scored.score desc)::integer as place
    from scored
  )
  select
    ranked.farmer_id,
    ranked.display_name,
    ranked.score,
    ranked.place
  from ranked
  order by ranked.place, ranked.display_name
  limit 20;
end;
$$;

revoke all on function public.list_global_leaderboard(text) from public, anon, authenticated;
grant execute on function public.list_global_leaderboard(text) to authenticated;
