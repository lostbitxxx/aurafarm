-- Rename coupons (max 3), custom pet names, and show-pet-names preference.
-- Run this after 0046_claim_without_apply.sql. Safe to run again.

alter table public.profiles
  add column if not exists rename_coupons integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_rename_coupons_check;

alter table public.profiles
  add constraint profiles_rename_coupons_check
  check (rename_coupons between 0 and 3);

alter table public.profiles
  add column if not exists show_pet_names boolean not null default true;

alter table public.user_pets
  add column if not exists name text;

alter table public.user_pets
  drop constraint if exists user_pets_name_check;

alter table public.user_pets
  add constraint user_pets_name_check
  check (name is null or char_length(btrim(name)) between 1 and 16);

alter table public.collection_items
  drop constraint if exists collection_items_kind_check;

alter table public.collection_items
  add constraint collection_items_kind_check
  check (kind in ('color', 'hat', 'clothes', 'rename_coupon'));

insert into public.collection_items (id, kind, name)
values ('rename_coupon', 'rename_coupon', 'Rename coupon')
on conflict (id) do nothing;

create or replace function public.claim_collection_reward(target_item text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_id uuid;
  item_kind text;
  coupon_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select kind into item_kind
  from public.collection_items
  where id = target_item;

  if item_kind is null then
    raise exception 'Item not in the collection';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  if item_kind = 'rename_coupon' then
    select rename_coupons into coupon_count
    from public.profiles
    where id = auth.uid()
    for update;

    if coupon_count is null then
      raise exception 'Not authenticated';
    end if;

    if coupon_count >= 3 then
      raise exception 'Maximum coupon reached';
    end if;

    select id into reward_id
    from public.collection_rewards
    where user_id = auth.uid()
      and item_id is null
    order by level_reached, id
    limit 1
    for update;

    if reward_id is null then
      raise exception 'No reward to claim';
    end if;

    update public.profiles
    set rename_coupons = rename_coupons + 1
    where id = auth.uid();

    update public.collection_rewards
    set item_id = target_item
    where id = reward_id;

    return;
  end if;

  if exists (
    select 1
    from public.user_collections
    where user_id = auth.uid()
      and item_id = target_item
  ) then
    raise exception 'Item already owned';
  end if;

  select id into reward_id
  from public.collection_rewards
  where user_id = auth.uid()
    and item_id is null
  order by level_reached, id
  limit 1
  for update;

  if reward_id is null then
    raise exception 'No reward to claim';
  end if;

  insert into public.user_collections (user_id, item_id)
  values (auth.uid(), target_item);

  update public.collection_rewards
  set item_id = target_item
  where id = reward_id;
end;
$$;

revoke all on function public.claim_collection_reward(text) from public, anon;
grant execute on function public.claim_collection_reward(text) to authenticated;

create or replace function public.rename_pet(target_pet uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text;
  coupon_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  trimmed := btrim(coalesce(new_name, ''));
  if char_length(trimmed) < 1 or char_length(trimmed) > 16 then
    raise exception 'Pick a name between 1 and 16 characters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  select rename_coupons into coupon_count
  from public.profiles
  where id = auth.uid()
  for update;

  if coupon_count is null then
    raise exception 'Not authenticated';
  end if;

  if coupon_count < 1 then
    raise exception 'No rename coupon';
  end if;

  if not exists (
    select 1
    from public.user_pets
    where id = target_pet
      and user_id = auth.uid()
  ) then
    raise exception 'Pet not found';
  end if;

  update public.user_pets
  set name = trimmed
  where id = target_pet
    and user_id = auth.uid();

  update public.profiles
  set rename_coupons = rename_coupons - 1
  where id = auth.uid();
end;
$$;

revoke all on function public.rename_pet(uuid, text) from public, anon;
grant execute on function public.rename_pet(uuid, text) to authenticated;

create or replace function public.update_show_pet_names(enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if enabled is null then
    raise exception 'Choose whether to show pet names';
  end if;

  update public.profiles
  set show_pet_names = enabled
  where id = auth.uid();
end;
$$;

revoke all on function public.update_show_pet_names(boolean) from public, anon;
grant execute on function public.update_show_pet_names(boolean) to authenticated;

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
  coupon_count integer;
  cosmetic_open integer;
  coupon_open integer;
  inserted_count integer;
  pet_found boolean;
  prior_count integer;
  prior_day date;
  streak_was_live boolean;
  counts_for_streak boolean;
  streak_day date;
  hk_today date;
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
    hk_today := (timezone('Asia/Hong_Kong', now()))::date;
    streak_day := case
      when session_row.planned_seconds >= streak_min_seconds then hk_today
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

      select count(*) into catalog_count
      from public.collection_items
      where kind in ('color', 'hat', 'clothes');
      select count(*) into owned_count
      from public.user_collections
      where user_id = session_row.user_id;
      select count(*) into pending_count
      from public.collection_rewards
      where user_id = session_row.user_id
        and item_id is null;
      select rename_coupons into coupon_count
      from public.profiles
      where id = session_row.user_id;

      cosmetic_open := greatest(0, catalog_count - owned_count);
      coupon_open := greatest(0, 3 - coalesce(coupon_count, 0));
      open_slots := greatest(0, cosmetic_open + coupon_open - pending_count);

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
  'Awards study XP. A qualifying finish records the Hong Kong calendar day from the server clock, not the caller local_day.';

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
      clothes = null,
      name = null
  where user_id = farmer;

  update public.profiles
  set streak_count = 0,
      streak_local_date = null,
      rename_coupons = 0
  where id = farmer;
end;
$$;

revoke all on function public.reset_study_world(text) from public, anon;
grant execute on function public.reset_study_world(text) to authenticated;

comment on function public.reset_study_world(text) is
  'Sets the signed-in farmer''s pets to level 1 and 0 experience, clears worn colors, hats, clothes, names, rename coupons, streak, and extra songs, and deletes that farmer''s study sessions, collection, and unspent rewards.';
