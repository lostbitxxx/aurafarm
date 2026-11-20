-- FarmCrew library poses. Each member publishes their own pet.
-- Other members read the rows (and the realtime stream) so walking,
-- sitting, and dragging match on every screen.
-- Paste this file into the Supabase SQL editor.

create table if not exists public.farm_crew_pose (
  crew_id uuid not null references public.farm_crew (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  left_pct numeric not null,
  top_pct numeric not null,
  mode text not null,
  seat_id text,
  face_left boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (crew_id, user_id),
  constraint farm_crew_pose_mode_check check (mode in ('idle', 'walking', 'sitting', 'dragging')),
  constraint farm_crew_pose_seat_check check (
    seat_id is null or seat_id in ('nw', 'ne', 'w', 'e', 'sw', 'se')
  ),
  constraint farm_crew_pose_pct_check check (
    left_pct between 0 and 100 and top_pct between 0 and 100
  )
);

comment on table public.farm_crew_pose is
  'Latest FarmCrew library pose for one member. The owner client is authoritative.';

alter table public.farm_crew_pose enable row level security;

revoke all on public.farm_crew_pose from public, anon, authenticated;

drop policy if exists farm_crew_pose_select on public.farm_crew_pose;

create or replace function public.set_farm_crew_pose(
  target uuid,
  p_left numeric,
  p_top numeric,
  p_mode text,
  p_seat text,
  p_face_left boolean
)
returns table (
  user_id uuid,
  left_pct numeric,
  top_pct numeric,
  mode text,
  seat_id text,
  face_left boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  stored_mode text;
  stored_seat text;
begin
  if auth.uid() is null then
    return;
  end if;

  if not exists (
    select 1
    from public.farm_crew_member member
    where member.crew_id = target
      and member.user_id = auth.uid()
      and member.status = 'accepted'
  ) then
    return;
  end if;

  if p_mode not in ('idle', 'walking', 'sitting', 'dragging') then
    return;
  end if;

  p_left := least(100, greatest(0, p_left));
  p_top := least(100, greatest(0, p_top));
  stored_mode := p_mode;
  stored_seat := nullif(p_seat, '');

  if stored_mode = 'sitting'
    and stored_seat in ('nw', 'ne', 'w', 'e', 'sw', 'se')
    and not exists (
      select 1
      from public.farm_crew_pose pose
      where pose.crew_id = target
        and pose.seat_id = stored_seat
        and pose.mode = 'sitting'
        and pose.user_id <> auth.uid()
        and pose.updated_at > now() - interval '2 minutes'
    )
  then
    stored_seat := stored_seat;
  else
    if stored_mode = 'sitting' then
      stored_mode := 'idle';
    end if;
    stored_seat := null;
  end if;

  insert into public.farm_crew_pose (
    crew_id, user_id, left_pct, top_pct, mode, seat_id, face_left, updated_at
  )
  values (
    target, auth.uid(), p_left, p_top, stored_mode, stored_seat, coalesce(p_face_left, false), now()
  )
  on conflict (crew_id, user_id) do update
  set
    left_pct = excluded.left_pct,
    top_pct = excluded.top_pct,
    mode = excluded.mode,
    seat_id = excluded.seat_id,
    face_left = excluded.face_left,
    updated_at = now();

  return query
  select
    pose.user_id,
    pose.left_pct,
    pose.top_pct,
    pose.mode,
    pose.seat_id,
    pose.face_left
  from public.farm_crew_pose pose
  where pose.crew_id = target
    and pose.user_id = auth.uid();
end;
$$;

revoke all on function public.set_farm_crew_pose(uuid, numeric, numeric, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_farm_crew_pose(uuid, numeric, numeric, text, text, boolean)
  to authenticated;

create or replace function public.list_farm_crew_poses(target uuid)
returns table (
  user_id uuid,
  left_pct numeric,
  top_pct numeric,
  mode text,
  seat_id text,
  face_left boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if not exists (
    select 1
    from public.farm_crew_member member
    where member.crew_id = target
      and member.user_id = auth.uid()
      and member.status = 'accepted'
  ) then
    return;
  end if;

  return query
  select
    pose.user_id,
    pose.left_pct,
    pose.top_pct,
    pose.mode,
    pose.seat_id,
    pose.face_left,
    pose.updated_at
  from public.farm_crew_pose pose
  where pose.crew_id = target;
end;
$$;

revoke all on function public.list_farm_crew_poses(uuid) from public, anon, authenticated;
grant execute on function public.list_farm_crew_poses(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'farm_crew_pose'
    )
  then
    alter publication supabase_realtime add table public.farm_crew_pose;
  end if;
end $$;

alter table public.farm_crew_pose replica identity full;

notify pgrst, 'reload schema';
