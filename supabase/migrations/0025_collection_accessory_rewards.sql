-- The eight approved hats and clothes can be chosen as a level reward.
-- Equipping them is still unsupported. Run this after 0024_collection_level_rewards.sql.

insert into public.collection_items (id, kind, name)
values
  ('little-gentleman-top-hat', 'hat', 'Little Gentleman: Top Hat'),
  ('summer-garden-straw-hat', 'hat', 'Summer Garden: Straw Hat'),
  ('flower-day-daisy-clip', 'hat', 'Flower Day: Daisy Clip'),
  ('lucky-heart-clover-clip', 'hat', 'Lucky Heart: Clover Clip'),
  ('sleepy-companion-nightcap', 'hat', 'Sleepy Companion: Nightcap'),
  ('little-artist-beret', 'hat', 'Little Artist: Beret'),
  ('forest-mushroom-mushroom-cap', 'hat', 'Forest Mushroom: Mushroom Cap'),
  ('little-wizard-star-hat', 'hat', 'Little Wizard: Star Hat'),
  ('little-gentleman-suit', 'clothes', 'Little Gentleman: Suit'),
  ('summer-garden-vest', 'clothes', 'Summer Garden: Vest'),
  ('flower-day-dress', 'clothes', 'Flower Day: Dress'),
  ('lucky-heart-heart-shorts', 'clothes', 'Lucky Heart: Heart Shorts'),
  ('sleepy-companion-star-pajamas', 'clothes', 'Sleepy Companion: Star Pajamas'),
  ('little-artist-paint-apron', 'clothes', 'Little Artist: Paint Apron'),
  ('forest-mushroom-woodland-vest', 'clothes', 'Forest Mushroom: Woodland Vest'),
  ('little-wizard-wizard-robe', 'clothes', 'Little Wizard: Wizard Robe')
on conflict (id) do nothing;
