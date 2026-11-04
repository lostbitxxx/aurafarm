-- Aurafarm: study sessions, the global blocklist, and one score per session.
-- Run this after 0001_profiles_and_user_pets.sql.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.blocklist_hosts (
  host text primary key check (
    host = lower(host)
    and position('/' in host) = 0
    and position(':' in host) = 0
    and char_length(host) between 1 and 253
  ),
  label text not null check (char_length(label) between 1 and 64)
);

insert into public.blocklist_hosts (host, label)
values
  ('instagram.com', 'Instagram'),
  ('tiktok.com', 'TikTok'),
  ('youtube.com', 'YouTube')
on conflict (host) do nothing;

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'submitted', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  session_token_hash text check (session_token_hash is null or session_token_hash ~ '^[0-9a-f]{64}$'),
  launch_code_hash text not null check (launch_code_hash ~ '^[0-9a-f]{64}$'),
  launch_code_expires_at timestamptz not null,
  claimed_at timestamptz,
  blocked_count integer not null default 0 check (blocked_count >= 0),
  blocked_hosts text[] not null default '{}',
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists study_sessions_one_active
  on public.study_sessions (user_id)
  where status = 'active';

create table if not exists public.study_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.study_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null check (points in (40, 100)),
  distracted boolean not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  blocked_count integer not null check (blocked_count >= 0),
  blocked_hosts text[] not null,
  created_at timestamptz not null default now()
);

alter table public.blocklist_hosts enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_scores enable row level security;

drop policy if exists "blocklist_hosts_select_authenticated" on public.blocklist_hosts;
create policy "blocklist_hosts_select_authenticated"
  on public.blocklist_hosts
  for select
  to authenticated
  using (true);

drop policy if exists "study_sessions_select_own" on public.study_sessions;
create policy "study_sessions_select_own"
  on public.study_sessions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "study_sessions_insert_own" on public.study_sessions;
create policy "study_sessions_insert_own"
  on public.study_sessions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'active'
    and session_token_hash is null
    and claimed_at is null
    and blocked_count = 0
    and duration_seconds is null
  );

drop policy if exists "study_sessions_update_cancel_own" on public.study_sessions;
create policy "study_sessions_update_cancel_own"
  on public.study_sessions
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'active')
  with check (user_id = auth.uid() and status = 'cancelled');

drop policy if exists "study_scores_select_own" on public.study_scores;
create policy "study_scores_select_own"
  on public.study_scores
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.blocklist_hosts from public, anon, authenticated;
revoke all on table public.study_sessions from public, anon, authenticated;
revoke all on table public.study_scores from public, anon, authenticated;

grant select on table public.blocklist_hosts to authenticated;
grant select, insert, update on table public.study_sessions to authenticated;
grant select on table public.study_scores to authenticated;

-- Authenticated updates may only cancel an active session. Score writes run as
-- the function owner and are allowed through this guard.
create or replace function public.guard_study_session_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.id is distinct from old.id
    or new.session_token_hash is distinct from old.session_token_hash
    or new.launch_code_hash is distinct from old.launch_code_hash
    or new.launch_code_expires_at is distinct from old.launch_code_expires_at
    or new.claimed_at is distinct from old.claimed_at
    or new.blocked_count is distinct from old.blocked_count
    or new.blocked_hosts is distinct from old.blocked_hosts
    or new.duration_seconds is distinct from old.duration_seconds
    or new.started_at is distinct from old.started_at
    or new.created_at is distinct from old.created_at
    or old.status is distinct from 'active'
    or new.status is distinct from 'cancelled'
  then
    raise exception 'Only an active session can be cancelled';
  end if;

  new.ended_at := now();
  return new;
end;
$$;

drop trigger if exists study_sessions_guard_update on public.study_sessions;
create trigger study_sessions_guard_update
  before update on public.study_sessions
  for each row
  execute function public.guard_study_session_update();

revoke all on function public.guard_study_session_update() from public, anon, authenticated;

create or replace function public.submit_study_score(
  target_session_id uuid,
  raw_token text,
  duration_seconds integer,
  blocked_count integer,
  blocked_hosts text[]
)
returns table (points integer, distracted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  session_row public.study_sessions%rowtype;
  filtered text[];
  effective_count integer;
  result_points integer;
  result_distracted boolean;
begin
  if raw_token is null or raw_token = '' then
    raise exception 'Score rejected';
  end if;
  if duration_seconds is null or duration_seconds < 0 or blocked_count is null or blocked_count < 0 then
    raise exception 'Score rejected';
  end if;

  token_hash := encode(extensions.digest(raw_token, 'sha256'), 'hex');

  select * into session_row
  from public.study_sessions
  where id = target_session_id
  for update;

  if not found
    or session_row.session_token_hash is null
    or session_row.session_token_hash <> token_hash then
    raise exception 'Score rejected';
  end if;

  if session_row.status = 'submitted' then
    raise exception 'Score already submitted';
  end if;

  if session_row.status <> 'active' then
    raise exception 'Score rejected';
  end if;

  select coalesce(array_agg(distinct lower(candidate)), '{}')
  into filtered
  from unnest(coalesce(blocked_hosts, '{}'::text[])) as candidate
  where candidate is not null
    and candidate <> ''
    and exists (
      select 1
      from public.blocklist_hosts listed
      where lower(candidate) = listed.host
        or (
          length(lower(candidate)) > length(listed.host) + 1
          and right(lower(candidate), length(listed.host) + 1) = '.' || listed.host
        )
    );

  effective_count := greatest(blocked_count, coalesce(array_length(filtered, 1), 0));
  result_distracted := effective_count > 0;
  result_points := case when result_distracted then 40 else 100 end;

  update public.study_sessions
  set status = 'submitted',
      ended_at = now(),
      duration_seconds = submit_study_score.duration_seconds,
      blocked_count = effective_count,
      blocked_hosts = filtered
  where id = target_session_id;

  insert into public.study_scores (
    session_id,
    user_id,
    points,
    distracted,
    duration_seconds,
    blocked_count,
    blocked_hosts
  )
  values (
    target_session_id,
    session_row.user_id,
    result_points,
    result_distracted,
    submit_study_score.duration_seconds,
    effective_count,
    filtered
  );

  return query select result_points, result_distracted;
exception
  when unique_violation then
    raise exception 'Score already submitted';
end;
$$;

revoke all on function public.submit_study_score(uuid, text, integer, integer, text[]) from public;
grant execute on function public.submit_study_score(uuid, text, integer, integer, text[]) to anon, authenticated;

create or replace function public.cancel_study_session(target_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.study_sessions
  set status = 'cancelled',
      ended_at = now()
  where id = target_session_id
    and user_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'Session not found';
  end if;
end;
$$;

revoke all on function public.cancel_study_session(uuid) from public;
grant execute on function public.cancel_study_session(uuid) to authenticated;
