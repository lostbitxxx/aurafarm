"use server";

import { revalidatePath } from "next/cache";
import { devTimerPasswordMatches } from "@/lib/study";
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
  revalidatePath("/shop");
  return { error: "" };
}
