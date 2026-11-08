"use server";

import { isAnyDeviceFresh } from "@/lib/pet-device";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function readPetPresence() {
  if (!isSupabaseConfigured()) return { running: false };

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) return { running: false };

  const { data: devices, error } = await supabase
    .from("pet_devices")
    .select("last_seen_at")
    .eq("user_id", userId);

  if (error) return { running: false };

  return {
    running: isAnyDeviceFresh(
      (devices ?? []).map((device) =>
        device.last_seen_at ? String(device.last_seen_at) : null,
      ),
      Date.now(),
    ),
  };
}
