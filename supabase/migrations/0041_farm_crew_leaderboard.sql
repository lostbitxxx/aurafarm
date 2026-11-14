-- FarmCrew leaderboard. Run this after 0040_farm_crew_visibility.sql.
-- Same scores as the friend board: submitted and cancelled sessions with a duration,
-- month and week in Asia/Hong_Kong (weeks start Monday), or the sum of pet levels.
-- Only accepted members of the crew are ranked. Ties share a rank.

create or replace function public.list_farm_crew_leaderboard(target uuid, board text)
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

  if not exists (
    select 1
    from public.farm_crew_member
    where crew_id = target
      and user_id = auth.uid()
      and status = 'accepted'
  ) then
    return;
  end if;

  month_start := date_trunc('month', timezone('Asia/Hong_Kong', now())) at time zone 'Asia/Hong_Kong';
  week_start := date_trunc('week', timezone('Asia/Hong_Kong', now())) at time zone 'Asia/Hong_Kong';

  return query
  with people as (
    select farm_crew_member.user_id as farmer_id
    from public.farm_crew_member
    where farm_crew_member.crew_id = target
      and farm_crew_member.status = 'accepted'
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

revoke all on function public.list_farm_crew_leaderboard(uuid, text) from public, anon, authenticated;
grant execute on function public.list_farm_crew_leaderboard(uuid, text) to authenticated;
