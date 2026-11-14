-- hat_c through hat_j and clothes_c through clothes_j have no artwork.
-- Unequip them, return any reward spent on them, and drop the catalog rows.
-- Run this after 0035_claim_applies_reward.sql.

update public.user_pets
set hat = null
where hat in (
  'hat_c', 'hat_d', 'hat_e', 'hat_f', 'hat_g', 'hat_h', 'hat_i', 'hat_j'
);

update public.user_pets
set clothes = null
where clothes in (
  'clothes_c', 'clothes_d', 'clothes_e', 'clothes_f',
  'clothes_g', 'clothes_h', 'clothes_i', 'clothes_j'
);

update public.collection_rewards
set item_id = null
where item_id in (
  'hat_c', 'hat_d', 'hat_e', 'hat_f', 'hat_g', 'hat_h', 'hat_i', 'hat_j',
  'clothes_c', 'clothes_d', 'clothes_e', 'clothes_f',
  'clothes_g', 'clothes_h', 'clothes_i', 'clothes_j'
);

delete from public.user_collections
where item_id in (
  'hat_c', 'hat_d', 'hat_e', 'hat_f', 'hat_g', 'hat_h', 'hat_i', 'hat_j',
  'clothes_c', 'clothes_d', 'clothes_e', 'clothes_f',
  'clothes_g', 'clothes_h', 'clothes_i', 'clothes_j'
);

delete from public.collection_items
where id in (
  'hat_c', 'hat_d', 'hat_e', 'hat_f', 'hat_g', 'hat_h', 'hat_i', 'hat_j',
  'clothes_c', 'clothes_d', 'clothes_e', 'clothes_f',
  'clothes_g', 'clothes_h', 'clothes_i', 'clothes_j'
);

alter table public.user_pets drop constraint if exists user_pets_hat_check;
alter table public.user_pets
  add constraint user_pets_hat_check
  check (
    hat is null
    or hat in (
      'hat_a', 'hat_b',
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
      'clothes_a', 'clothes_b',
      'little-gentleman-suit', 'summer-garden-vest', 'flower-day-dress',
      'lucky-heart-heart-shorts', 'sleepy-companion-star-pajamas', 'little-artist-paint-apron',
      'forest-mushroom-woodland-vest', 'little-wizard-wizard-robe'
    )
  );
