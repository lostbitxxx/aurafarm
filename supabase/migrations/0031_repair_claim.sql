-- Restores claim_study_session after 0029 or 0030 changed its result.
-- A changed result leaves PostgREST serving "Claim rejected" for a real code.
-- The session is still marked claimed, so the same code cannot be tried again.
-- Run this whole file in the Supabase SQL editor, then start a new desktop session.

drop function if exists public.claim_study_session(text, text);

create function public.claim_study_session(raw_code text, token_hash text)
returns table (
  session_id uuid,
  pet_type text,
  level integer,
  blocklist text[],
  close_blocked boolean,
  planned_seconds integer,
  started_at timestamptz
)
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
  close_flag boolean;
begin
  if raw_code is null or raw_code = '' or token_hash is null or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Claim rejected: the launch code could not be checked';
  end if;

  code_hash := encode(extensions.digest(raw_code, 'sha256'), 'hex');

  select * into session_row
  from public.study_sessions as session
  where session.launch_code_hash = code_hash
    and session.status = 'active'
    and session.claimed_at is null
    and session.launch_code_expires_at > now()
    and session.use_desktop_pet is true
  order by session.started_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Claim rejected: no active desktop session for that code. Start a new session and paste the new code within 5 minutes.';
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

  select profiles.close_blocked
  into close_flag
  from public.profiles
  where id = session_row.user_id;

  session_id := session_row.id;
  pet_type := coalesce(equipped_type, 'baby_slime');
  level := coalesce(equipped_level, 1);
  blocklist := hosts;
  close_blocked := coalesce(close_flag, false);
  planned_seconds := session_row.planned_seconds;
  started_at := session_row.started_at;
  return next;
end;
$$;

revoke all on function public.claim_study_session(text, text) from public, anon, authenticated;
grant execute on function public.claim_study_session(text, text) to anon;

notify pgrst, 'reload schema';
