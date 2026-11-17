import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  customizationMigrationMessage,
  defaultWeekdaysForLifestyle,
  isStudyMode,
  normalizeStudyWeekdays,
  parseBehaviorAnswers,
  type BehaviorAnswers,
  type StudyMode,
  type StudyPlan,
} from "./study-mode";
import { touchSocialPresence } from "./actions/friends";
import { createClient } from "./supabase/server";

export type SavedStudyPlan = StudyPlan & {
  completed: boolean;
  answers: BehaviorAnswers | null;
};

export async function loadCustomizationGate() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");

  const selectWithWeekly =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, study_days_per_week, weekly_study_days, behavior_answers, customization_completed_at";
  const selectLegacy =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, study_days_per_week, behavior_answers, customization_completed_at";

  let profileResult = await supabase.from("profiles").select(selectWithWeekly).eq("id", userId).maybeSingle();
  const weeklyColumnMissing = /weekly_study_days/i.test(profileResult.error?.message ?? "");
  if (weeklyColumnMissing) {
    profileResult = await supabase.from("profiles").select(selectLegacy).eq("id", userId).maybeSingle();
  }

  const profileError = weeklyColumnMissing ? null : (profileResult.error?.message ?? null);
  const migrationError = customizationMigrationMessage(profileError);
  if (migrationError || profileError) {
    return {
      userId,
      displayName: "Farmer",
      completed: false,
      plan: null as SavedStudyPlan | null,
      error: migrationError ?? profileError,
    };
  }

  const profile = profileResult.data;
  const completed = Boolean(profile?.customization_completed_at);
  await touchSocialPresence(true);
  const mode = profile?.study_mode;
  const answers = parseBehaviorAnswers(profile?.behavior_answers);
  const weekdays =
    normalizeStudyWeekdays(
      weeklyColumnMissing ? null : (profile as { weekly_study_days?: unknown } | null)?.weekly_study_days,
    ) ??
    (answers ? defaultWeekdaysForLifestyle(answers.lifestyle) : defaultWeekdaysForLifestyle("steady"));
  const plan =
    completed && isStudyMode(mode)
      ? ({
          mode,
          sessionMinutes: Number(profile?.preferred_session_minutes ?? 60),
          studyWeekdays: weekdays,
          studyDaysPerWeek: weekdays.length,
          completed: true,
          answers,
        } satisfies SavedStudyPlan)
      : null;

  return {
    userId,
    displayName: profile?.display_name?.trim() || "Farmer",
    completed,
    plan,
    error: null as string | null,
  };
}

export async function requireCustomizationComplete() {
  const gate = await loadCustomizationGate();
  if (gate.error) return gate;
  if (!gate.completed) redirect("/customize");
  return gate;
}
