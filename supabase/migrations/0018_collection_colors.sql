-- Twelve color ranges are owned once per account, then applied to any pet that account owns.
-- A lighter or darker shade of one range is an SVG edit, not another row.

create table if not exists public.collection_items (
  id text primary key,
  kind text not null check (kind in ('color', 'hat', 'clothes')),
  name text not null check (char_length(name) between 1 and 32)
);

insert into public.collection_items (id, kind, name)
values
  ('honey', 'color', 'Honey'),
  ('apricot', 'color', 'Apricot'),
  ('rose', 'color', 'Rose'),
  ('coral', 'color', 'Coral'),
  ('lavender', 'color', 'Lavender'),
  ('sage', 'color', 'Sage'),
  ('mint', 'color', 'Mint'),
  ('sky', 'color', 'Sky'),
  ('lemon', 'color', 'Lemon'),
  ('slate', 'color', 'Slate'),
  ('white', 'color', 'White'),
  ('black', 'color', 'Black')
on conflict (id) do nothing;

create table if not exists public.user_collections (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.collection_items (id),
  primary key (user_id, item_id)
);

alter table public.user_pets add column if not exists color text;

alter table public.user_pets drop constraint if exists user_pets_color_check;

alter table public.user_pets
  add constraint user_pets_color_check
  check (color is null or color in ('honey', 'apricot', 'rose', 'coral', 'lavender', 'sage', 'mint', 'sky', 'lemon', 'slate', 'white', 'black'));

comment on column public.user_pets.color is
  'Applied color id. Null keeps the pet type default. Ownership lives in user_collections, not on the pet.';

insert into public.user_collections (user_id, item_id)
select profiles.id, samples.item_id
from public.profiles
cross join (
  values ('honey'), ('apricot'), ('rose'), ('coral'), ('lavender'), ('sage'), ('mint'), ('sky'), ('lemon'), ('slate'), ('white'), ('black')
) as samples(item_id)
on conflict do nothing;

alter table public.collection_items enable row level security;
alter table public.user_collections enable row level security;

drop policy if exists "collection_items_select_authenticated" on public.collection_items;
create policy "collection_items_select_authenticated"
  on public.collection_items
  for select
  to authenticated
  using (true);

drop policy if exists "user_collections_select_own" on public.user_collections;
create policy "user_collections_select_own"
  on public.user_collections
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.collection_items to authenticated;
grant select on table public.user_collections to authenticated;

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
  from (values ('honey'), ('apricot'), ('rose'), ('coral'), ('lavender'), ('sage'), ('mint'), ('sky'), ('lemon'), ('slate'), ('white'), ('black')) as samples(item_id)
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

create or replace function public.apply_pet_color(target_pet_id uuid, target_color text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_color is null or target_color not in ('honey', 'apricot', 'rose', 'coral', 'lavender', 'sage', 'mint', 'sky', 'lemon', 'slate', 'white', 'black') then
    raise exception 'Color not in the collection';
  end if;

  if not exists (
    select 1
    from public.user_pets
    where id = target_pet_id
      and user_id = auth.uid()
  ) then
    raise exception 'Pet not found';
  end if;

  if not exists (
    select 1
    from public.user_collections
    join public.collection_items on collection_items.id = user_collections.item_id
    where user_collections.user_id = auth.uid()
      and user_collections.item_id = target_color
      and collection_items.kind = 'color'
  ) then
    raise exception 'Color not owned';
  end if;

  update public.user_pets
  set color = target_color
  where id = target_pet_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.apply_pet_color(uuid, text) from public, anon;
grant execute on function public.apply_pet_color(uuid, text) to authenticated;
