-- Pet installs, heartbeats, and the one-time study-session claim.
-- The phase 6 plan called this 0003. That number is already the score-function fix.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.pet_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null default 'Windows pet' check (char_length(label) between 1 and 64),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pet_devices_user_id_idx on public.pet_devices (user_id);

alter table public.pet_devices enable row level security;

drop policy if exists "pet_devices_select_own" on public.pet_devices;
create policy "pet_devices_select_own"
  on public.pet_devices
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.pet_devices from public, anon, authenticated;
grant select on table public.pet_devices to authenticated;

create or replace function public.pair_pet_device(token_hash text, label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  device_id uuid;
  chosen_label text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to pair a pet';
  end if;
  if token_hash is null or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Pairing rejected';
  end if;

  chosen_label := coalesce(nullif(trim(label), ''), 'Windows pet');
  if char_length(chosen_label) > 64 then
    raise exception 'Pairing rejected';
  end if;

  insert into public.pet_devices (user_id, token_hash, label)
  values (auth.uid(), token_hash, chosen_label)
  returning id into device_id;

  return device_id;
end;
$$;

create or replace function public.touch_pet_device(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  if raw_token is null or raw_token = '' then
    raise exception 'Heartbeat rejected';
  end if;

  update public.pet_devices
  set last_seen_at = now()
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  returning user_id into owner;

  if not found then
    raise exception 'Heartbeat rejected';
  end if;

  return owner;
end;
$$;

create or replace function public.claim_study_session(raw_code text, token_hash text)
returns table (session_id uuid, pet_type text, level integer, blocklist text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  code_hash text;
  session_row public.study_sessions%rowtype;
  equipped_type text;
  equipped_level integer;
  hosts text[];
begin
  if raw_code is null or raw_code = '' or token_hash is null or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Claim rejected';
  end if;

  code_hash := encode(extensions.digest(raw_code, 'sha256'), 'hex');

  select * into session_row
  from public.study_sessions
  where launch_code_hash = code_hash
    and status = 'active'
    and claimed_at is null
    and launch_code_expires_at > now()
  order by started_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Claim rejected';
  end if;

  update public.study_sessions
  set session_token_hash = claim_study_session.token_hash,
      claimed_at = now()
  where id = session_row.id;

  select user_pets.pet_type, user_pets.level
  into equipped_type, equipped_level
  from public.user_pets
  where user_id = session_row.user_id
    and is_desktop_active
  limit 1;

  select coalesce(array_agg(blocklist_hosts.host order by blocklist_hosts.host), '{}')
  into hosts
  from public.blocklist_hosts;

  session_id := session_row.id;
  pet_type := coalesce(equipped_type, 'baby_slime');
  level := coalesce(equipped_level, 1);
  blocklist := hosts;
  return next;
end;
$$;

revoke all on function public.pair_pet_device(text, text) from public, anon, authenticated;
revoke all on function public.touch_pet_device(text) from public, anon, authenticated;
revoke all on function public.claim_study_session(text, text) from public, anon, authenticated;

grant execute on function public.pair_pet_device(text, text) to authenticated;
grant execute on function public.touch_pet_device(text) to anon;
grant execute on function public.claim_study_session(text, text) to anon;
