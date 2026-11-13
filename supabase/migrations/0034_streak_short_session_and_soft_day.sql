-- Short custom sessions (< 5 min) and out-of-range local_day must not move the streak.
-- Keeps the unified pet submit from 0033_one_score_function.sql.
-- Run this after 0033_one_score_function.sql. Safe to run again.

create or replace function public.grant_study_experience(
  target_session_id uuid,
  studied_seconds integer,
  distracted boolean,
  blocked_count integer,
  blocked_hosts text[],
  apply_finish_bonus boolean,
  local_day date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  xp_per_minute constant integer := 2;
  finish_bonus constant integer := 11;
  streak_bonus constant integer := 11;
  distracted_penalty constant integer := 7;
  streak_min_seconds constant integer := 300;
  session_row public.study_sessions%rowtype;
  recorded integer;
  minutes integer;
  gained integer;
  previous_xp integer;
  previous_level integer;
  next_level integer;
  level_step integer;
  open_slots integer;
  catalog_count integer;
  owned_count integer;
  pending_count integer;
  inserted_count integer;
  pet_found boolean;
  prior_count integer;
  prior_day date;
  streak_was_live boolean;
  counts_for_streak boolean;
  streak_day date;
begin
  select * into session_row
  from public.study_sessions
  where id = target_session_id
  for update;

  if not found or session_row.status <> 'active' then
    return 0;
  end if;

  recorded := least(
    session_row.planned_seconds,
    greatest(0, coalesce(studied_seconds, 0))
  );
  minutes := recorded / 60;
  gained := minutes * xp_per_minute;
  if apply_finish_bonus then
    gained := gained * finish_bonus / 10;
    streak_day := case
      when local_day is not null
        and session_row.planned_seconds >= streak_min_seconds
        and local_day >= (current_date - 1)
        and local_day <= (current_date + 1)
      then local_day
      else null
    end;
    counts_for_streak := streak_day is not null;
    if counts_for_streak then
      select streak_count, streak_local_date
      into prior_count, prior_day
      from public.profiles
      where id = session_row.user_id
      for update;

      streak_was_live :=
        coalesce(prior_count, 0) >= 1
        and (
          prior_day = streak_day
          or prior_day = (streak_day - 1)
        );

      perform public.touch_daily_streak(session_row.user_id, streak_day);

      if streak_was_live then
        gained := gained * streak_bonus / 10;
      end if;
    end if;
  end if;
  if distracted then
    gained := gained * distracted_penalty / 10;
  end if;

  if session_row.pet_id is null then
    gained := 0;
  else
    select xp into previous_xp
    from public.user_pets
    where id = session_row.pet_id
      and user_id = session_row.user_id
    for update;

    pet_found := found;
    if pet_found then
      previous_level := 1 + (previous_xp / 100);
    end if;

    update public.user_pets
    set xp = user_pets.xp + gained,
        level = 1 + ((user_pets.xp + gained) / 100)
    where id = session_row.pet_id
      and user_id = session_row.user_id
    returning level into next_level;

    if pet_found and next_level > previous_level then
      perform pg_advisory_xact_lock(hashtextextended(session_row.user_id::text, 0));

      select count(*) into catalog_count from public.collection_items;
      select count(*) into owned_count
      from public.user_collections
      where user_id = session_row.user_id;
      select count(*) into pending_count
      from public.collection_rewards
      where user_id = session_row.user_id
        and item_id is null;

      open_slots := greatest(0, catalog_count - owned_count - pending_count);

      for level_step in (previous_level + 1)..next_level loop
        exit when open_slots <= 0;
        insert into public.collection_rewards (user_id, pet_id, level_reached)
        values (session_row.user_id, session_row.pet_id, level_step)
        on conflict (user_id, pet_id, level_reached) do nothing;
        get diagnostics inserted_count = row_count;
        if inserted_count > 0 then
          open_slots := open_slots - 1;
        end if;
      end loop;
    end if;
  end if;

  update public.study_sessions
  set status = 'submitted',
      ended_at = now(),
      duration_seconds = recorded,
      blocked_count = greatest(0, coalesce(grant_study_experience.blocked_count, 0)),
      blocked_hosts = coalesce(grant_study_experience.blocked_hosts, '{}'),
      xp_awarded = gained
  where id = session_row.id;

  return gained;
end;
$$;

revoke all on function public.grant_study_experience(uuid, integer, boolean, integer, text[], boolean, date) from public, anon, authenticated;

comment on function public.grant_study_experience(uuid, integer, boolean, integer, text[], boolean, date) is
  'Awards study XP. Short sessions and out-of-range streak days are skipped without failing the finish.';

create or replace function public.complete_study_timer(
  target_session_id uuid,
  dev_password text,
  local_day date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.study_sessions%rowtype;
  dev_finish boolean;
  streak_day date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into session_row
  from public.study_sessions
  where id = target_session_id
    and user_id = auth.uid()
  for update;

  if not found or session_row.status <> 'active' then
    return;
  end if;

  if session_row.use_desktop_pet then
    raise exception 'The desktop pet finishes this session';
  end if;

  dev_finish := dev_password = 'emia';
  if dev_finish is not true
    and now() + interval '5 seconds' < session_row.started_at + make_interval(secs => session_row.planned_seconds)
  then
    raise exception 'Study time has not finished';
  end if;

  streak_day := case
    when session_row.planned_seconds >= 300 then local_day
    else null
  end;

  perform public.grant_study_experience(
    session_row.id,
    session_row.planned_seconds,
    false,
    0,
    '{}'::text[],
    true,
    streak_day
  );
end;
$$;

revoke all on function public.complete_study_timer(uuid, text, date) from public;
grant execute on function public.complete_study_timer(uuid, text, date) to authenticated;
