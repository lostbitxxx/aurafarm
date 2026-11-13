-- Owned approved hats and clothes can be applied to a pet.
-- Run this after 0025_collection_accessory_rewards.sql.

alter table public.user_pets drop constraint if exists user_pets_hat_check;
alter table public.user_pets
  add constraint user_pets_hat_check
  check (
    hat is null
    or hat in (
      'hat_a', 'hat_b', 'hat_c', 'hat_d', 'hat_e', 'hat_f', 'hat_g', 'hat_h', 'hat_i', 'hat_j',
      'little-gentleman-top-hat', 'summer-garden-straw-hat', 'flower-day-daisy-clip',
      'lucky-heart-clover-clip', 'sleepy-companion-nightcap', 'little-artist-beret',
      'forest-mushroom-mushroom-cap', 'little-wizard-star-hat'
    )
  );

alter table public.user_pets drop constraint if exists user_pets_clothes_check;
alter table public.user_pets
  add constraint user_pets_clothes_check
  check (
    clothes is null
    or clothes in (
      'clothes_a', 'clothes_b', 'clothes_c', 'clothes_d', 'clothes_e',
      'clothes_f', 'clothes_g', 'clothes_h', 'clothes_i', 'clothes_j',
      'little-gentleman-suit', 'summer-garden-vest', 'flower-day-dress',
      'lucky-heart-heart-shorts', 'sleepy-companion-star-pajamas', 'little-artist-paint-apron',
      'forest-mushroom-woodland-vest', 'little-wizard-wizard-robe'
    )
  );

create or replace function public.apply_pet_hat(target_pet_id uuid, target_hat text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_pets
    where id = target_pet_id
      and user_id = auth.uid()
  ) then
    raise exception 'Pet not found';
  end if;

  if target_hat is not null and not exists (
    select 1
    from public.collection_items
    where id = target_hat
      and kind = 'hat'
  ) then
    raise exception 'Hat not in the collection';
  end if;

  if target_hat is not null and not exists (
    select 1
    from public.user_collections
    join public.collection_items on collection_items.id = user_collections.item_id
    where user_collections.user_id = auth.uid()
      and user_collections.item_id = target_hat
      and collection_items.kind = 'hat'
  ) then
    raise exception 'Hat not owned';
  end if;

  update public.user_pets
  set hat = target_hat
  where id = target_pet_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.apply_pet_clothes(target_pet_id uuid, target_clothes text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_pets
    where id = target_pet_id
      and user_id = auth.uid()
  ) then
    raise exception 'Pet not found';
  end if;

  if target_clothes is not null and not exists (
    select 1
    from public.collection_items
    where id = target_clothes
      and kind = 'clothes'
  ) then
    raise exception 'Clothes not in the collection';
  end if;

  if target_clothes is not null and not exists (
    select 1
    from public.user_collections
    join public.collection_items on collection_items.id = user_collections.item_id
    where user_collections.user_id = auth.uid()
      and user_collections.item_id = target_clothes
      and collection_items.kind = 'clothes'
  ) then
    raise exception 'Clothes not owned';
  end if;

  update public.user_pets
  set clothes = target_clothes
  where id = target_pet_id
    and user_id = auth.uid();
end;
$$;
