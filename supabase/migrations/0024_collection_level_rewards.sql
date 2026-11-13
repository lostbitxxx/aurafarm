-- Each new pet level banks one account-wide choice of an unowned collection item.
-- A missing hat or clothes file still draws the plain pet. This does not check artwork.
-- Existing user_collections rows stay. New accounts start with none.
-- Run this after 0023_shop_level_unlock.sql.

create table if not exists public.collection_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pet_id uuid not null references public.user_pets (id) on delete cascade,
  level_reached integer not null check (level_reached >= 2),
  item_id text references public.collection_items (id),
  unique (user_id, pet_id, level_reached)
);

comment on table public.collection_rewards is
  'One unspent choice per pet level gained. item_id stays null until the farmer claims a collection item.';

create index if not exists collection_rewards_unclaimed_idx
  on public.collection_rewards (user_id, level_reached, id)
  where item_id is null;

alter table public.collection_rewards enable row level security;

drop policy if exists "collection_rewards_select_own" on public.collection_rewards;
create policy "collection_rewards_select_own"
  on public.collection_rewards
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.collection_rewards to authenticated;

create or replace function public.grant_study_experience(
  target_session_id uuid,
  studied_seconds integer,
  distracted boolean,
  blocked_count integer,
  blocked_hosts text[],
  apply_finish_bonus boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  xp_per_minute constant integer := 2;
  finish_bonus constant integer := 11;
  distracted_penalty constant integer := 7;
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

revoke all on function public.grant_study_experience(uuid, integer, boolean, integer, text[], boolean) from public, anon, authenticated;

create or replace function public.claim_collection_reward(target_item text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.collection_items
    where id = target_item
  ) then
    raise exception 'Item not in the collection';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

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

  update public.user_pets
  set xp = 0,
      level = 1,
      color = null,
      hat = null,
      clothes = null
  where user_id = farmer;
end;
$$;

revoke all on function public.reset_study_world(text) from public, anon;
grant execute on function public.reset_study_world(text) to authenticated;

comment on function public.reset_study_world(text) is
  'Sets the signed-in farmer''s pets to level 1 and 0 experience, clears worn colors, hats, and clothes, and deletes that farmer''s study sessions, collection, and unspent rewards.';
