-- Letter ids stay (hat_a, clothes_a, and the rest). Only the shown name changes.
-- Run after 0020_collection_clothes.sql. Safe to re-run.

update public.collection_items as items
set name = renamed.name
from (
  values
    ('hat_a', 'Forest hat'),
    ('hat_b', 'Blue hat'),
    ('hat_c', 'Red hat'),
    ('hat_d', 'Pink hat'),
    ('hat_e', 'Yellow hat'),
    ('hat_f', 'Mint hat'),
    ('hat_g', 'Purple hat'),
    ('hat_h', 'White hat'),
    ('hat_i', 'Black hat'),
    ('hat_j', 'Orange hat'),
    ('clothes_a', 'Blue vest'),
    ('clothes_b', 'Brown vest'),
    ('clothes_c', 'Red vest'),
    ('clothes_d', 'Pink vest'),
    ('clothes_e', 'Yellow vest'),
    ('clothes_f', 'Green vest'),
    ('clothes_g', 'Purple vest'),
    ('clothes_h', 'White vest'),
    ('clothes_i', 'Black vest'),
    ('clothes_j', 'Orange vest')
) as renamed(id, name)
where items.id = renamed.id;
