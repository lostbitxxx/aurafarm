"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { devTimerPasswordMatches, parseLocalDay } from "@/lib/study";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function resetAllPets(password: string) {
  if (!devTimerPasswordMatches(password)) {
    return { error: "That password does not match." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in before resetting your pets." };
  }

  const { error } = await supabase.rpc("reset_study_world", {
    dev_password: password,
  });

  if (error) {
    console.error(`[admin] reset failed: ${error.message}`);
    if (/reset_study_world|schema cache/i.test(error.message)) {
      return { error: "Run migration 0016 before using the admin reset." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/inventory");
  return { error: "" };
}

export async function setDailyStreak(password: string, streakCount: number, localDay: string) {
  if (!devTimerPasswordMatches(password)) {
    return { error: "That password does not match.", streakCount: 0 };
  }
  const day = parseLocalDay(localDay);
  if (!day) {
    return { error: "Choose a valid local day for your streak.", streakCount: 0 };
  }
  if (!Number.isInteger(streakCount) || streakCount < 0 || streakCount > 10000) {
    return { error: "Streak count must be from 0 to 10000.", streakCount: 0 };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured.", streakCount: 0 };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { error: "Sign in before setting your streak.", streakCount: 0 };
  }

  const { data: rpcCount, error } = await supabase.rpc("set_daily_streak", {
    dev_password: password,
    target_count: streakCount,
    local_day: day,
  });

  if (!error) {
    revalidatePath("/dashboard", "layout");
    return {
      error: "",
      streakCount: typeof rpcCount === "number" ? rpcCount : streakCount,
    };
  }

  if (!/set_daily_streak|schema cache|streak_count|streak_local_date/i.test(error.message)) {
    console.error(`[admin] set streak failed: ${error.message}`);
    return { error: error.message, streakCount: 0 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      error: "Run migration 0028 before setting a streak, or configure the service role key.",
      streakCount: 0,
    };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      streak_count: streakCount,
      streak_local_date: streakCount === 0 ? null : day,
    })
    .eq("id", userId);

  if (updateError) {
    console.error(`[admin] set streak fallback failed: ${updateError.message}`);
    if (/streak_count|streak_local_date/i.test(updateError.message)) {
      return { error: "Run migration 0027 before setting a streak.", streakCount: 0 };
    }
    return { error: updateError.message, streakCount: 0 };
  }

  revalidatePath("/dashboard", "layout");
  return { error: "", streakCount };
}
