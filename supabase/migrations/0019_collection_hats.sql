-- Ten hat ids are owned once per account. Pets start with no hat.
-- hat_c through hat_j are already in the database. Adding one of them does not
-- need a migration. Copy the hat_a-* folders to hat_c-* (or the matching id)
-- under each pet color for cat and bunny, then edit those SVG files.

insert into public.collection_items (id, kind, name)
values
  ('hat_a', 'hat', 'hat_a'),
  ('hat_b', 'hat', 'hat_b'),
  ('hat_c', 'hat', 'hat_c'),
  ('hat_d', 'hat', 'hat_d'),
  ('hat_e', 'hat', 'hat_e'),
  ('hat_f', 'hat', 'hat_f'),
  ('hat_g', 'hat', 'hat_g'),
  ('hat_h', 'hat', 'hat_h'),
  ('hat_i', 'hat', 'hat_i'),
  ('hat_j', 'hat', 'hat_j')
on conflict (id) do nothing;

alter table public.user_pets add column if not exists hat text;

alter table public.user_pets drop constraint if exists user_pets_hat_check;

alter table public.user_pets
  add constraint user_pets_hat_check
  check (
    hat is null
    or hat in ('hat_a', 'hat_b', 'hat_c', 'hat_d', 'hat_e', 'hat_f', 'hat_g', 'hat_h', 'hat_i', 'hat_j')
  );

comment on column public.user_pets.hat is
  'Applied hat id. Null means no hat. Ownership lives in user_collections, not on the pet.';

insert into public.user_collections (user_id, item_id)
select profiles.id, samples.item_id
from public.profiles
cross join (
  values ('hat_a'), ('hat_b'), ('hat_c'), ('hat_d'), ('hat_e'), ('hat_f'), ('hat_g'), ('hat_h'), ('hat_i'), ('hat_j')
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
      ('hat_f'), ('hat_g'), ('hat_h'), ('hat_i'), ('hat_j')
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

  if target_hat is not null and target_hat not in ('hat_a', 'hat_b', 'hat_c', 'hat_d', 'hat_e', 'hat_f', 'hat_g', 'hat_h', 'hat_i', 'hat_j') then
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

revoke all on function public.apply_pet_hat(uuid, text) from public, anon;
grant execute on function public.apply_pet_hat(uuid, text) to authenticated;
