-- Older Aurafarm databases created public.profiles with id and email only.
-- The app and the signup trigger expect display_name. This adds that column
-- when it is missing and teaches the trigger to fill whichever columns exist.

alter table public.profiles add column if not exists display_name text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) then
    execute $u$
      update public.profiles
      set display_name = left(
        coalesce(nullif(split_part(email, '@', 1), ''), 'Farmer'),
        32
      )
      where display_name is null
    $u$;
  end if;
end
$$;

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

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
