-- Claiming a level reward only grants ownership. Equipping is optional in the app.
-- Run this after 0035_claim_applies_reward.sql. Safe to run again.

create or replace function public.claim_collection_reward(target_item text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_id uuid;
  item_kind text;
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
