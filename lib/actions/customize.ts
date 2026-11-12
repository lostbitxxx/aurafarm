"use server";

import { redirect } from "next/navigation";
import { customizationMigrationMessage, parseCustomizationInput } from "@/lib/study-mode";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CustomizeFormState = {
  error: string;
};

const emptyState: CustomizeFormState = { error: "" };

export async function saveCustomization(
  _prev: CustomizeFormState,
  formData: FormData,
): Promise<CustomizeFormState> {
  const parsed = parseCustomizationInput(formData);
  if (parsed.error) return { error: parsed.error };

  if (!isSupabaseConfigured()) {
    return { error: "Add Supabase keys before saving your study plan." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { error: "Sign in to save your study mode." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      study_mode: parsed.plan.mode,
      preferred_session_minutes: parsed.plan.sessionMinutes,
      monthly_session_goal: parsed.plan.monthlySessions,
      daily_session_goal: parsed.plan.dailySessions,
      study_days_per_week: parsed.plan.studyDaysPerWeek,
      behavior_answers: parsed.answers,
      customization_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    return {
      error: customizationMigrationMessage(error.message) ?? error.message,
    };
  }

  redirect("/dashboard");
}
