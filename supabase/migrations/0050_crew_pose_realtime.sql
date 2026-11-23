-- Let FarmCrew members subscribe to pet poses.
-- Paste this file into the Supabase SQL editor.
-- Reads go through a security-definer check, so this does not grant
-- select on farm_crew_member. Writes stay on set_farm_crew_pose.

create or replace function public.can_read_farm_crew_pose(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_crew_member member
    where member.crew_id = target
      and member.user_id = auth.uid()
      and member.status = 'accepted'
  );
$$;

revoke all on function public.can_read_farm_crew_pose(uuid) from public, anon, authenticated;
grant execute on function public.can_read_farm_crew_pose(uuid) to authenticated;

grant select on public.farm_crew_pose to authenticated;

drop policy if exists farm_crew_pose_select on public.farm_crew_pose;
create policy farm_crew_pose_select
  on public.farm_crew_pose
  for select
  to authenticated
  using (public.can_read_farm_crew_pose(crew_id));

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
