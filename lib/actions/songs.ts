"use server";

import { revalidatePath } from "next/cache";
import { songById } from "@/lib/songs";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function markSongSeen(songId: string) {
  if (!songById(songId)) return { error: "That song could not be marked." };
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) return { error: "Sign in to keep listening." };

  const { error } = await supabase.rpc("mark_song_seen", { target_song: songId });
  if (error) {
    if (/user_songs|mark_song_seen/i.test(error.message)) {
      return { error: "Run migration 0038 before unlocking desk songs." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: "" };
}
