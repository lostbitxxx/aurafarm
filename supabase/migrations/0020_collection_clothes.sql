-- Ten clothes ids are owned once per account. Pets start with no clothes.
-- clothes_c through clothes_j are already in the database. Adding one of them does not
-- need a migration. Copy the *-clothes_a folders to *-clothes_c (or the matching id)
-- under each pet color for cat and bunny, including no-hat, hat_a, and hat_b, then edit those SVG files.
-- Files: public/pet-assets/pets/{cat|bunny}/{color}/no-hat-clothes_a/{pose}.svg
-- With a hat: public/pet-assets/pets/{cat|bunny}/{color}/hat_a-clothes_a/{pose}.svg

insert into public.collection_items (id, kind, name)
values
  ('clothes_a', 'clothes', 'clothes_a'),
  ('clothes_b', 'clothes', 'clothes_b'),
  ('clothes_c', 'clothes', 'clothes_c'),
  ('clothes_d', 'clothes', 'clothes_d'),
  ('clothes_e', 'clothes', 'clothes_e'),
  ('clothes_f', 'clothes', 'clothes_f'),
  ('clothes_g', 'clothes', 'clothes_g'),
  ('clothes_h', 'clothes', 'clothes_h'),
  ('clothes_i', 'clothes', 'clothes_i'),
  ('clothes_j', 'clothes', 'clothes_j')
on conflict (id) do nothing;

alter table public.user_pets add column if not exists clothes text;

alter table public.user_pets drop constraint if exists user_pets_clothes_check;

alter table public.user_pets
  add constraint user_pets_clothes_check
  check (
    clothes is null
    or clothes in ('clothes_a', 'clothes_b', 'clothes_c', 'clothes_d', 'clothes_e', 'clothes_f', 'clothes_g', 'clothes_h', 'clothes_i', 'clothes_j')
  );

comment on column public.user_pets.clothes is
  'Applied clothes id. Null means no clothes. Ownership lives in user_collections, not on the pet.';

insert into public.user_collections (user_id, item_id)
select profiles.id, samples.item_id
from public.profiles
cross join (
  values
    ('clothes_a'), ('clothes_b'), ('clothes_c'), ('clothes_d'), ('clothes_e'),
    ('clothes_f'), ('clothes_g'), ('clothes_h'), ('clothes_i'), ('clothes_j')
) as samples(item_id)
on conflict do nothing;

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

  insert into public.user_collections (user_id, item_id)
  select new.id, samples.item_id
  from (
    values
      ('honey'), ('apricot'), ('rose'), ('coral'), ('lavender'), ('sage'),
      ('mint'), ('sky'), ('lemon'), ('slate'), ('white'), ('black'),
      ('hat_a'), ('hat_b'), ('hat_c'), ('hat_d'), ('hat_e'),
      ('hat_f'), ('hat_g'), ('hat_h'), ('hat_i'), ('hat_j'),
      ('clothes_a'), ('clothes_b'), ('clothes_c'), ('clothes_d'), ('clothes_e'),
      ('clothes_f'), ('clothes_g'), ('clothes_h'), ('clothes_i'), ('clothes_j')
  ) as samples(item_id)
  where not exists (
    select 1
    from public.user_collections
    where user_id = new.id
      and item_id = samples.item_id
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

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

  if target_clothes is not null and target_clothes not in ('clothes_a', 'clothes_b', 'clothes_c', 'clothes_d', 'clothes_e', 'clothes_f', 'clothes_g', 'clothes_h', 'clothes_i', 'clothes_j') then
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

revoke all on function public.apply_pet_clothes(uuid, text) from public, anon;
grant execute on function public.apply_pet_clothes(uuid, text) to authenticated;
