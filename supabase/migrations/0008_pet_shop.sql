-- Aurafarm: a spendable point balance and one purchase transaction.
-- Run this after 0007_close_blocked.sql.

alter table public.profiles
  add column if not exists points integer not null default 100;

alter table public.profiles
  drop constraint if exists profiles_points_nonnegative;

alter table public.profiles
  add constraint profiles_points_nonnegative check (points >= 0);

comment on column public.profiles.points is
  'Spendable balance. Study-session scores do not write this column.';

create unique index if not exists user_pets_one_type_per_user
  on public.user_pets (user_id, pet_type);

-- Table-wide update would let a signed-in user set points. Keep display_name
-- and close_blocked writable. purchase_pet changes points as definer.
revoke insert, update on table public.profiles from authenticated;
grant insert (id, display_name) on table public.profiles to authenticated;
grant update (display_name, close_blocked) on table public.profiles to authenticated;

drop policy if exists "user_pets_insert_own" on public.user_pets;
revoke insert on table public.user_pets from authenticated;

create or replace function public.purchase_pet(target_pet_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_pet_type is null or target_pet_type not in ('lantern_moth', 'river_newt') then
    raise exception 'Pet not for sale';
  end if;

  select points
  into balance
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1
    from public.user_pets
    where user_id = auth.uid()
      and pet_type = target_pet_type
  ) then
    raise exception 'Pet already owned';
  end if;

  if balance < 100 then
    raise exception 'Not enough points';
  end if;

  update public.profiles
  set points = points - 100
  where id = auth.uid();

  insert into public.user_pets (user_id, pet_type, level, is_desktop_active)
  values (auth.uid(), target_pet_type, 1, false);
end;
$$;

revoke all on function public.purchase_pet(text) from public, anon, authenticated;
grant execute on function public.purchase_pet(text) to authenticated;
