-- Aurafarm: profiles, pet inventory, and the desktop equip transaction.
-- Run this in the Supabase SQL editor, or with the Supabase CLI.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  created_at timestamptz not null default now()
);

create table if not exists public.user_pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pet_type text not null check (char_length(pet_type) between 1 and 64),
  level integer not null default 1 check (level >= 1),
  is_desktop_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_pets_user_id_idx on public.user_pets (user_id);

create unique index if not exists user_pets_one_desktop_active
  on public.user_pets (user_id)
  where is_desktop_active;

comment on column public.user_pets.is_desktop_active is
  'True for the single pet currently shown in the desktop Godot frame.';

alter table public.profiles enable row level security;
alter table public.user_pets enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "user_pets_select_own" on public.user_pets;
create policy "user_pets_select_own"
  on public.user_pets
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_pets_insert_own" on public.user_pets;
create policy "user_pets_insert_own"
  on public.user_pets
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_pets_update_own" on public.user_pets;
create policy "user_pets_update_own"
  on public.user_pets
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.user_pets to authenticated;

-- One transaction: clear every desktop flag for this user, then equip the chosen pet.
create or replace function public.equip_pet_to_desktop(target_pet_id uuid)
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

  update public.user_pets
  set is_desktop_active = false
  where user_id = auth.uid()
    and is_desktop_active = true;

  update public.user_pets
  set is_desktop_active = true
  where id = target_pet_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.equip_pet_to_desktop(uuid) from public;
grant execute on function public.equip_pet_to_desktop(uuid) to authenticated;

-- Creates the profile and starter pet inside the signup transaction, including
-- when email confirmation means the browser does not have a session yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Farmer'
  );
  chosen_name := left(chosen_name, 32);

  insert into public.profiles (id, display_name)
  values (new.id, chosen_name)
  on conflict (id) do nothing;

  insert into public.user_pets (user_id, pet_type, level, is_desktop_active)
  select new.id, 'baby_slime', 1, true
  where not exists (
    select 1 from public.user_pets where user_id = new.id
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
