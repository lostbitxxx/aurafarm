-- Public or private FarmCrews. Run this after 0039_farm_crew.sql.
-- Drops the two-argument create function from the first version of 0039.

drop function if exists public.create_farm_crew(text, text);

create or replace function public.create_farm_crew(input_name text, input_description text, input_public boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  pet_types constant text[] := array['baby_slime', 'lantern_moth', 'river_newt'];
  colors constant text[] := array['sage', 'honey', 'sky', 'lavender', 'mint', 'coral'];
  chosen_name text;
  chosen_description text;
  candidate text;
  created_id uuid;
  attempt integer;
  i integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  chosen_name := trim(regexp_replace(coalesce(input_name, ''), '\s+', ' ', 'g'));
  chosen_description := trim(regexp_replace(coalesce(input_description, ''), '\s+', ' ', 'g'));

  if chosen_name = '' or char_length(chosen_name) > 32 then
    raise exception 'Name the FarmCrew.';
  end if;

  if char_length(chosen_description) > 200 then
    raise exception 'Shorten the description.';
  end if;

  if input_public is null then
    raise exception 'Choose public or private.';
  end if;

  for attempt in 1..30 loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;

    begin
      insert into public.farm_crew (name, description, crew_code, pet_type, pet_color, is_public, created_by)
      values (
        chosen_name,
        chosen_description,
        candidate,
        pet_types[1 + floor(random() * array_length(pet_types, 1))::integer],
        colors[1 + floor(random() * array_length(colors, 1))::integer],
        input_public,
        auth.uid()
      )
      returning id into created_id;

      insert into public.farm_crew_member (crew_id, user_id, role, status, joined_at)
      values (created_id, auth.uid(), 'owner', 'accepted', now());

      return created_id;
    exception
      when unique_violation then
        created_id := null;
    end;
  end loop;

  raise exception 'Could not create a FarmCrew.';
end;
$$;

revoke all on function public.create_farm_crew(text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_farm_crew(text, text, boolean) to authenticated;
