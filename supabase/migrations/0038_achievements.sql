-- Saved achievements. Run this after 0037_global_leaderboard.sql.
-- State unlocks are granted by evaluate_achievements. Friend unlocks are granted
-- when a friend request is sent or a friendship is accepted, and are not
-- re-checked from the current friend list.

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id),
  constraint user_achievements_id_check check (
    achievement_id in (
      'true_colors',
      'hats_all',
      'wardrobe',
      'week_of_wisdom',
      'thirty_days',
      'top_20',
      'on_your_left',
      'blend_in',
      'new_friend',
      'study_buddies'
    )
  )
);

comment on table public.user_achievements is
  'Achievements the farmer has earned. Missing rows stay undone until granted again.';

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
  on public.user_achievements
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.user_achievements to authenticated;

drop function if exists public.grant_achievement(uuid, text);

create or replace function public.grant_achievement(farmer uuid, target_achievement text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if farmer is null then
    return;
  end if;

  insert into public.user_achievements (user_id, achievement_id)
  values (farmer, target_achievement)
  on conflict (user_id, achievement_id) do nothing;
end;
$$;

revoke all on function public.grant_achievement(uuid, text) from public, anon, authenticated;

comment on function public.grant_achievement(uuid, text) is
  'Inserts one earned achievement. Later calls keep the original earned time.';

create or replace function public.evaluate_achievements()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  farmer uuid := auth.uid();
  owned_count integer;
  catalog_count integer;
  streak integer;
  my_score bigint := 0;
  my_place integer;
begin
  if farmer is null then
    return;
  end if;

  select count(*)::integer
  into owned_count
  from public.user_collections
  join public.collection_items on collection_items.id = user_collections.item_id
  where user_collections.user_id = farmer
    and collection_items.kind = 'color';

  select count(*)::integer
  into catalog_count
  from public.collection_items
  where kind = 'color';

  if catalog_count > 0 and owned_count >= catalog_count then
    perform public.grant_achievement(farmer, 'true_colors');
  end if;

  select count(*)::integer
  into owned_count
  from public.user_collections
  join public.collection_items on collection_items.id = user_collections.item_id
  where user_collections.user_id = farmer
    and collection_items.kind = 'hat';

  select count(*)::integer
  into catalog_count
  from public.collection_items
  where kind = 'hat';

  if catalog_count > 0 and owned_count >= catalog_count then
    perform public.grant_achievement(farmer, 'hats_all');
  end if;

  select count(*)::integer
  into owned_count
  from public.user_collections
  join public.collection_items on collection_items.id = user_collections.item_id
  where user_collections.user_id = farmer
    and collection_items.kind = 'clothes';

  select count(*)::integer
  into catalog_count
  from public.collection_items
  where kind = 'clothes';

  if catalog_count > 0 and owned_count >= catalog_count then
    perform public.grant_achievement(farmer, 'wardrobe');
  end if;

  select streak_count
  into streak
  from public.profiles
  where id = farmer;

  if streak >= 7 then
    perform public.grant_achievement(farmer, 'week_of_wisdom');
  end if;

  if streak >= 30 then
    perform public.grant_achievement(farmer, 'thirty_days');
  end if;

  select mine.score,
         (1 + count(*) filter (where others.score > mine.score))::integer
  into my_score, my_place
  from (
    select
      profiles.id as farmer_id,
      coalesce((
        select sum(study_sessions.duration_seconds)::bigint
        from public.study_sessions
        where study_sessions.user_id = profiles.id
          and study_sessions.status in ('submitted', 'cancelled')
          and study_sessions.duration_seconds is not null
      ), 0) as score
    from public.profiles
  ) as mine
  left join (
    select
      profiles.id as farmer_id,
      coalesce((
        select sum(study_sessions.duration_seconds)::bigint
        from public.study_sessions
        where study_sessions.user_id = profiles.id
          and study_sessions.status in ('submitted', 'cancelled')
          and study_sessions.duration_seconds is not null
      ), 0) as score
    from public.profiles
  ) as others on others.farmer_id <> mine.farmer_id
  where mine.farmer_id = farmer
  group by mine.score;

  if my_score > 0 and my_place <= 20 then
    perform public.grant_achievement(farmer, 'top_20');
  end if;

  if exists (
    select 1
    from public.friendship
    where friendship.status = 'accepted'
      and (friendship.user_a = farmer or friendship.user_b = farmer)
      and coalesce((
        select sum(study_sessions.duration_seconds)::bigint
        from public.study_sessions
        where study_sessions.user_id = case
            when friendship.user_a = farmer then friendship.user_b
            else friendship.user_a
          end
          and study_sessions.status in ('submitted', 'cancelled')
          and study_sessions.duration_seconds is not null
      ), 0) < my_score
  ) then
    perform public.grant_achievement(farmer, 'on_your_left');
  end if;

  if exists (
    select 1
    from public.user_pets
    where user_id = farmer
      and hat = 'flower-day-daisy-clip'
      and clothes is null
  ) then
    perform public.grant_achievement(farmer, 'blend_in');
  end if;
end;
$$;

revoke all on function public.evaluate_achievements() from public, anon;
grant execute on function public.evaluate_achievements() to authenticated;

comment on function public.evaluate_achievements() is
  'Grants collection, streak, top 20, overtake, and daisy-clip achievements that the signed-in farmer currently meets.';

create or replace function public.send_friend_request(target_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  normalized text := upper(trim(coalesce(target_code, '')));
  owner_id uuid;
  invite_mode text;
  low_id uuid;
  high_id uuid;
  existing_status text;
  existing_by uuid;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  if normalized !~ '^[ABCDEFGHIJKLMNPQRSTUVWXYZ23456789]{8}$' then
    raise exception 'Unknown friend code';
  end if;

  select user_id, friend_invite
  into owner_id, invite_mode
  from public.social_profile
  where friend_code = normalized;

  if owner_id is null then
    raise exception 'Unknown friend code';
  end if;

  if owner_id = caller then
    raise exception 'That is your friend code';
  end if;

  if caller < owner_id then
    low_id := caller;
    high_id := owner_id;
  else
    low_id := owner_id;
    high_id := caller;
  end if;

  select status, requested_by
  into existing_status, existing_by
  from public.friendship
  where user_a = low_id
    and user_b = high_id
  for update;

  if existing_status = 'accepted' then
    raise exception 'Already friends';
  end if;

  if existing_status = 'pending' and existing_by = caller then
    raise exception 'Friend request already sent';
  end if;

  if existing_status = 'pending' and existing_by = owner_id then
    update public.friendship
    set status = 'accepted',
        befriend_at = now()
    where user_a = low_id
      and user_b = high_id;
    perform public.grant_achievement(caller, 'study_buddies');
    perform public.grant_achievement(low_id, 'new_friend');
    perform public.grant_achievement(high_id, 'new_friend');
    return;
  end if;

  if invite_mode = 'disabled' then
    raise exception 'Friend requests are closed';
  end if;

  if invite_mode = 'open' then
    begin
      insert into public.friendship (user_a, user_b, requested_by, status, befriend_at)
      values (low_id, high_id, caller, 'accepted', now());
    exception
      when unique_violation then
        raise exception 'Friend request already sent';
    end;
    perform public.grant_achievement(caller, 'study_buddies');
    perform public.grant_achievement(low_id, 'new_friend');
    perform public.grant_achievement(high_id, 'new_friend');
    return;
  end if;

  begin
    insert into public.friendship (user_a, user_b, requested_by, status, befriend_at)
    values (low_id, high_id, caller, 'pending', null);
  exception
    when unique_violation then
      raise exception 'Friend request already sent';
  end;

  perform public.grant_achievement(caller, 'study_buddies');
end;
$$;

revoke all on function public.send_friend_request(text) from public, anon, authenticated;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.accept_friend(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  updated_id uuid;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  if target_user is null or target_user = caller then
    raise exception 'No friend request to accept';
  end if;

  update public.friendship
  set status = 'accepted',
      befriend_at = now()
  where status = 'pending'
    and requested_by = target_user
    and (
      (user_a = caller and user_b = target_user)
      or (user_b = caller and user_a = target_user)
    )
  returning user_a into updated_id;

  if updated_id is null then
    raise exception 'No friend request to accept';
  end if;

  perform public.grant_achievement(caller, 'new_friend');
  perform public.grant_achievement(target_user, 'new_friend');
end;
$$;

revoke all on function public.accept_friend(uuid) from public, anon, authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;

insert into public.user_achievements (user_id, achievement_id)
select distinct friendship.user_a, 'new_friend'
from public.friendship
where friendship.status = 'accepted'
on conflict (user_id, achievement_id) do nothing;

insert into public.user_achievements (user_id, achievement_id)
select distinct friendship.user_b, 'new_friend'
from public.friendship
where friendship.status = 'accepted'
on conflict (user_id, achievement_id) do nothing;

insert into public.user_achievements (user_id, achievement_id)
select distinct friendship.requested_by, 'study_buddies'
from public.friendship
on conflict (user_id, achievement_id) do nothing;

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

  delete from public.user_achievements
  where user_id = farmer;
end;
$$;

revoke all on function public.reset_study_world(text) from public, anon;
grant execute on function public.reset_study_world(text) to authenticated;

comment on function public.reset_study_world(text) is
  'Sets the signed-in farmer''s pets to level 1 and 0 experience, clears worn colors, hats, clothes, streak, and achievements, and deletes that farmer''s study sessions, collection, and unspent rewards.';
