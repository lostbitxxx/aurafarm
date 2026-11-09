"use server";

import { revalidatePath } from "next/cache";
import { createLaunchCode, hashSecret } from "@/lib/scoring";
import {
  closeBlockedMigrationMessage,
  plannedStudySeconds,
  startSessionDecision,
  studyTimerMigrationMessage,
} from "@/lib/study";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LAUNCH_CODE_TTL_MS = 5 * 60 * 1000;

export async function startStudySession(planned: number) {
  const plannedSeconds = plannedStudySeconds(planned);
  if (plannedSeconds === null) {
    return { error: "Choose a study length.", launchCode: "", sessionId: "" };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured.", launchCode: "", sessionId: "" };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { error: "Sign in to start a study session.", launchCode: "", sessionId: "" };
  }

  const { count, error: countError } = await supabase
    .from("study_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (countError) {
    return { error: countError.message, launchCode: "", sessionId: "" };
  }

  const decision = startSessionDecision(count ?? 0);
  if (decision.error) {
    return { error: decision.error, launchCode: "", sessionId: "" };
  }

  const { data: equipped } = await supabase
    .from("user_pets")
    .select("id")
    .eq("user_id", userId)
    .eq("is_desktop_active", true)
    .maybeSingle();

  const launchCode = createLaunchCode();
  const { data: created, error: insertError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: userId,
      launch_code_hash: hashSecret(launchCode),
      launch_code_expires_at: new Date(Date.now() + LAUNCH_CODE_TTL_MS).toISOString(),
      planned_seconds: plannedSeconds,
      pet_id: equipped?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "A study session is already running.", launchCode: "", sessionId: "" };
    }
    return {
      error: studyTimerMigrationMessage(insertError.message) ?? insertError.message,
      launchCode: "",
      sessionId: "",
    };
  }

  revalidatePath("/dashboard");
  return { error: "", launchCode, sessionId: String(created.id) };
}

export async function setCloseBlocked(enabled: boolean) {
  if (typeof enabled !== "boolean") {
    return { error: "Choose whether blocked tabs close." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { error: "Sign in to change this." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ close_blocked: enabled })
    .eq("id", userId);

  if (error) return { error: closeBlockedMigrationMessage(error.message) ?? error.message };

  revalidatePath("/dashboard");
  return { error: "" };
}

export async function cancelStudySession(sessionId: string) {
  if (!sessionIdPattern.test(sessionId)) {
    return { error: "That session could not be cancelled." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in to cancel a study session." };
  }

  const { error } = await supabase.rpc("cancel_study_session", {
    target_session_id: sessionId,
  });

  if (error) {
    console.error(`[score] cancel ${sessionId} failed: ${error.message}`);
    return { error: studyTimerMigrationMessage(error.message) ?? error.message };
  }
  console.info(`[score] cancel ${sessionId} user ${data.claims.sub}`);

  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  return { error: "" };
}

export async function completeStudyTimer(sessionId: string, devPassword = "") {
  if (!sessionIdPattern.test(sessionId)) {
    return { error: "That session could not be finished." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in to finish a study session." };
  }

  const { error } = await supabase.rpc("complete_study_timer", {
    target_session_id: sessionId,
    dev_password: devPassword,
  });

  if (error) {
    console.error(`[score] timer ${sessionId} failed: ${error.message}`);
    return { error: studyTimerMigrationMessage(error.message) ?? error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  return { error: "" };
}
