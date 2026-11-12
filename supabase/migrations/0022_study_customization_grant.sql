-- Let the signed-in farmer save the study plan added in 0021.
-- Run this after 0021_study_customization.sql.
-- 0008 keeps points off the client update grant. This adds only the study columns.

grant update (
  study_mode,
  preferred_session_minutes,
  monthly_session_goal,
  daily_session_goal,
  study_days_per_week,
  behavior_answers,
  customization_completed_at
) on table public.profiles to authenticated;
