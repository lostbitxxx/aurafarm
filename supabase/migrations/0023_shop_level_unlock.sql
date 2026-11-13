-- Shop pets unlock from the farmer's highest pet level.
-- Lantern Moth at level 2, River Newt at level 4: one new pet every two levels.
-- Run this after 0022_study_customization_grant.sql.

create or replace function public.purchase_pet(target_pet_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  farmer_level integer;
  required_level integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  required_level := case target_pet_type
    when 'lantern_moth' then 2
    when 'river_newt' then 4
    else null
  end;

  if required_level is null then
    raise exception 'Pet not for sale';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
  ) then
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

  select coalesce(max(1 + (greatest(xp, 0) / 100)), 1)
    into farmer_level
  from public.user_pets
  where user_id = auth.uid();

  if farmer_level < required_level then
    raise exception 'Reach level % to unlock this pet', required_level;
  end if;

  insert into public.user_pets (user_id, pet_type, level, is_desktop_active)
  values (auth.uid(), target_pet_type, 1, false);
end;
$$;

revoke all on function public.purchase_pet(text) from public, anon, authenticated;
grant execute on function public.purchase_pet(text) to authenticated;
