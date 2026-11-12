-- Admin reset: every pet returns to level 1 with no experience, and study rows are removed.
-- Run this after 0014_end_study_early.sql.

create or replace function public.reset_study_world(dev_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if dev_password is distinct from 'emia' then
    raise exception 'That password does not match';
  end if;

  if to_regclass('public.study_scores') is not null then
    delete from public.study_scores;
  end if;

  delete from public.study_sessions;

  update public.user_pets
  set xp = 0,
      level = 1;
end;
$$;

revoke all on function public.reset_study_world(text) from public;
grant execute on function public.reset_study_world(text) to anon, authenticated;

comment on function public.reset_study_world(text) is
  'Sets every pet to level 1 and 0 experience, then deletes every study session.';
