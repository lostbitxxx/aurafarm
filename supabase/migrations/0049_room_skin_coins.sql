-- Study coins and purchasable room furniture skins.
-- Earn 1 coin per full minute studied. Buy skins in the decorate dialog.

alter table public.profiles
  add column if not exists coins integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_coins_nonnegative;

alter table public.profiles
  add constraint profiles_coins_nonnegative check (coins >= 0);

comment on column public.profiles.coins is
  'Spendable coins. Earn 1 per full study minute. Spent on room furniture skins.';

create table if not exists public.room_skin_catalog (
  category_id text not null,
  skin_id text not null,
  price integer not null check (price >= 0),
  primary key (category_id, skin_id)
);

comment on table public.room_skin_catalog is
  'Purchasable room skins. Base skins are free and not listed. Trim rows are grants from wall purchases (price 0).';

insert into public.room_skin_catalog (category_id, skin_id, price)
values
  -- Plants
  ('plant', 'snake', 30),
  ('plant', 'monstera', 30),
  ('plant', 'pothos', 30),
  -- Lamp / carpet
  ('lamp', 'greenhouse', 60),
  ('lamp', 'orbital', 60),
  ('lamp', 'leather', 60),
  ('carpet', 'greenhouse', 60),
  ('carpet', 'orbital', 60),
  ('carpet', 'leather', 60),
  -- Shelf / sofa
  ('shelf', 'greenhouse', 90),
  ('shelf', 'orbital', 90),
  ('shelf', 'leather', 90),
  ('sofa', 'greenhouse', 90),
  ('sofa', 'orbital', 90),
  ('sofa', 'leather', 90),
  -- Floor / wall
  ('floor', 'greenhouse', 120),
  ('floor', 'orbital', 120),
  ('floor', 'leather', 120),
  ('wall', 'greenhouse', 120),
  ('wall', 'orbital', 120),
  ('wall', 'leather', 120),
  -- Trim granted with matching wall (not sold directly)
  ('trim', 'greenhouse', 0),
  ('trim', 'orbital', 0),
  ('trim', 'leather', 0)
on conflict (category_id, skin_id) do update
set price = excluded.price;

create table if not exists public.user_room_skins (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id text not null,
  skin_id text not null,
  primary key (user_id, category_id, skin_id),
  foreign key (category_id, skin_id)
    references public.room_skin_catalog (category_id, skin_id)
);

comment on table public.user_room_skins is
  'Room skins a farmer owns. Base skins are always owned and not stored here.';

alter table public.room_skin_catalog enable row level security;
alter table public.user_room_skins enable row level security;

drop policy if exists "room_skin_catalog_select_authenticated" on public.room_skin_catalog;
create policy "room_skin_catalog_select_authenticated"
  on public.room_skin_catalog
  for select
  to authenticated
  using (true);

drop policy if exists "user_room_skins_select_own" on public.user_room_skins;
create policy "user_room_skins_select_own"
  on public.user_room_skins
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.room_skin_catalog to authenticated;
grant select on table public.user_room_skins to authenticated;

create or replace function public.purchase_room_skin(
  target_category text,
  target_skin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  farmer uuid;
  catalog_price integer;
  balance integer;
begin
  farmer := auth.uid();
  if farmer is null then
    raise exception 'Not authenticated';
  end if;

  if target_skin is null or target_skin = 'base' then
    raise exception 'Base skins are already owned';
  end if;

  if target_category = 'trim' then
    raise exception 'Trim skins come with the matching wall';
  end if;

  select price into catalog_price
  from public.room_skin_catalog
  where category_id = target_category
    and skin_id = target_skin;

  if not found or catalog_price is null or catalog_price <= 0 then
    raise exception 'That skin is not for sale';
  end if;

  if exists (
    select 1
    from public.user_room_skins
    where user_id = farmer
      and category_id = target_category
      and skin_id = target_skin
  ) then
    raise exception 'Skin already owned';
  end if;

  select coins into balance
  from public.profiles
  where id = farmer
  for update;

  if not found then
    raise exception 'Not authenticated';
  end if;

  if balance < catalog_price then
    raise exception 'Not enough coins';
  end if;

  update public.profiles
  set coins = coins - catalog_price
  where id = farmer;

  insert into public.user_room_skins (user_id, category_id, skin_id)
  values (farmer, target_category, target_skin);

  if target_category = 'wall' then
    insert into public.user_room_skins (user_id, category_id, skin_id)
    values (farmer, 'trim', target_skin)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.purchase_room_skin(text, text) from public, anon;
grant execute on function public.purchase_room_skin(text, text) to authenticated;

comment on function public.purchase_room_skin(text, text) is
  'Buys one room skin for coins. Wall purchases also grant the matching trim skin.';

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

  update public.profiles
  set coins = coins + minutes
  where id = session_row.user_id;

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
  'Awards study XP and 1 coin per full minute studied. A qualifying finish records the Hong Kong calendar day from the server clock, not the caller local_day.';

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

  delete from public.user_room_skins
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
      rename_coupons = 0,
      coins = 0
  where id = farmer;
end;
$$;

revoke all on function public.reset_study_world(text) from public, anon;
grant execute on function public.reset_study_world(text) to authenticated;

comment on function public.reset_study_world(text) is
  'Sets the signed-in farmer''s pets to level 1 and 0 experience, clears worn colors, hats, clothes, names, rename coupons, coins, room skins, streak, and extra songs, and deletes that farmer''s study sessions, collection, and unspent rewards.';
