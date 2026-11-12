"use server";

import { revalidatePath } from "next/cache";
import { devTimerPasswordMatches } from "@/lib/study";
import { createAnonClient } from "@/lib/supabase/anon";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function resetAllPets(password: string) {
  if (!devTimerPasswordMatches(password)) {
    return { error: "That password does not match." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = createAnonClient();
  const { error } = await supabase.rpc("reset_study_world", {
    dev_password: password,
  });

  if (error) {
    console.error(`[admin] reset failed: ${error.message}`);
    if (/reset_study_world|schema cache/i.test(error.message)) {
      return { error: "Run migration 0015 before using the admin reset." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/shop");
  return { error: "" };
}
