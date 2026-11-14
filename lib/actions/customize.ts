"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customizationMigrationMessage, parseCustomizationInput } from "@/lib/study-mode";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CustomizeFormState = {
  error: string;
  saved: boolean;
};

const emptyState: CustomizeFormState = { error: "", saved: false };

export async function saveCustomization(
  _prev: CustomizeFormState,
  formData: FormData,
): Promise<CustomizeFormState> {
  const parsed = parseCustomizationInput(formData);
  if (parsed.error) return { ...emptyState, error: parsed.error };

  if (!isSupabaseConfigured()) {
    return { ...emptyState, error: "Add Supabase keys before saving your study plan." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { ...emptyState, error: "Sign in to save your study mode." };
  }

  const existing = await supabase
    .from("profiles")
    .select("customization_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (existing.error) {
    return {
      ...emptyState,
      error: customizationMigrationMessage(existing.error.message) ?? existing.error.message,
    };
  }
  const firstCompletion = !existing.data?.customization_completed_at;

  const { data: saved, error } = await supabase
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
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ...emptyState,
      error: customizationMigrationMessage(error.message) ?? error.message,
    };
  }
  if (!saved) {
    return { ...emptyState, error: "Could not find your profile to save the study plan." };
  }

  const embedded = String(formData.get("embedded") ?? "") === "1";
  if (embedded) {
    revalidatePath("/dashboard");
    return { error: "", saved: true };
  }

  redirect(firstCompletion ? "/dashboard?tutorial=1" : "/dashboard");
}
