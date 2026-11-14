-- Desk songs. Sunday in Blue is owned from level 1. Another song unlocks
-- every two levels of the farmer's highest pet: 2, 4, then 6.
-- Run this after 0034_streak_short_session_and_soft_day.sql. Safe to run again.

create table if not exists public.songs (
  id text primary key,
  title text not null,
  unlock_level integer not null check (unlock_level >= 1)
);

comment on table public.songs is
  'Desk music catalog. unlock_level is the highest pet level that grants the song.';

create table if not exists public.user_songs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_id text not null references public.songs (id),
  seen_at timestamptz,
  primary key (user_id, song_id)
);

comment on table public.user_songs is
  'Songs a farmer owns. seen_at stays null until the unlock celebration has been shown.';

alter table public.songs enable row level security;
alter table public.user_songs enable row level security;

drop policy if exists "songs_select_authenticated" on public.songs;
create policy "songs_select_authenticated"
  on public.songs
  for select
  to authenticated
  using (true);

drop policy if exists "user_songs_select_own" on public.user_songs;
create policy "user_songs_select_own"
  on public.user_songs
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.songs to authenticated;
grant select on table public.user_songs to authenticated;

insert into public.songs (id, title, unlock_level)
values
  ('sunday-in-blue', 'Sunday in Blue', 1),
  ('little-by-little', 'Little by Little', 2),
  ('golden-hour', 'Golden Hour', 4),
  ('velvet-afternoon', 'Velvet Afternoon', 6)
on conflict (id) do update
set title = excluded.title,
    unlock_level = excluded.unlock_level;

insert into public.user_songs (user_id, song_id, seen_at)
select profiles.id, songs.id, now()
from public.profiles
join public.songs
  on songs.unlock_level <= coalesce(
    (select max(user_pets.level) from public.user_pets where user_pets.user_id = profiles.id),
    1
  )
on conflict (user_id, song_id) do nothing;

create or replace function public.mark_song_seen(target_song text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.user_songs
  set seen_at = now()
  where user_id = auth.uid()
    and song_id = target_song
    and seen_at is null;
end;
$$;

revoke all on function public.mark_song_seen(text) from public, anon;
grant execute on function public.mark_song_seen(text) to authenticated;

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
  previous_highest integer := 1;
  next_highest integer := 1;
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

    select coalesce(max(level), 1) into previous_highest
    from public.user_pets
    where user_id = session_row.user_id;

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

      next_highest := greatest(previous_highest, next_level);
      if next_highest > previous_highest then
        insert into public.user_songs (user_id, song_id)
        select session_row.user_id, songs.id
        from public.songs
        where songs.unlock_level > previous_highest
          and songs.unlock_level <= next_highest
        on conflict (user_id, song_id) do nothing;
      end if;
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
  'Awards study XP and grants desk songs when the highest pet level crosses 2, 4, or 6.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
  has_display boolean;
  has_email boolean;
begin
  chosen_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Farmer'
  );
  chosen_name := left(chosen_name, 32);

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) into has_display;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_email;

  if has_display and has_email then
    insert into public.profiles (id, display_name, email)
    values (new.id, chosen_name, coalesce(new.email, ''))
    on conflict (id) do nothing;
  elsif has_display then
    insert into public.profiles (id, display_name)
    values (new.id, chosen_name)
    on conflict (id) do nothing;
  elsif has_email then
    insert into public.profiles (id, email)
    values (new.id, coalesce(new.email, ''))
    on conflict (id) do nothing;
  end if;

  insert into public.user_pets (user_id, pet_type, level, is_desktop_active)
  select new.id, 'baby_slime', 1, true
  where not exists (
    select 1 from public.user_pets where user_id = new.id
  );

  insert into public.user_songs (user_id, song_id, seen_at)
  select new.id, songs.id, now()
  from public.songs
  where songs.id = 'sunday-in-blue'
  on conflict (user_id, song_id) do nothing;

  perform public.ensure_social_profile(new.id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.reset_study_world(dev_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  farmer uuid;
begin
  if dev_password is distinct from 'emia' then
    raise exception 'That password does not match';
  end if;

  farmer := auth.uid();
  if farmer is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.study_scores') is not null then
    execute 'delete from public.study_scores where user_id = $1' using farmer;
  end if;

  delete from public.study_sessions
  where user_id = farmer;

  delete from public.collection_rewards
  where user_id = farmer;

  delete from public.user_collections
  where user_id = farmer;

  delete from public.user_songs
  where user_id = farmer;

  insert into public.user_songs (user_id, song_id, seen_at)
  select farmer, songs.id, now()
  from public.songs
  where songs.id = 'sunday-in-blue';

  update public.user_pets
  set xp = 0,
      level = 1,
      color = null,
      hat = null,
      clothes = null
  where user_id = farmer;

  update public.profiles
  set streak_count = 0,
      streak_local_date = null
  where id = farmer;
end;
$$;

revoke all on function public.reset_study_world(text) from public, anon;
grant execute on function public.reset_study_world(text) to authenticated;

comment on function public.reset_study_world(text) is
  'Sets the signed-in farmer''s pets to level 1 and 0 experience, clears worn colors, hats, clothes, streak, and extra songs, and deletes that farmer''s study sessions, collection, and unspent rewards.';
