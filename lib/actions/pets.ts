"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const petIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function equipPetToDesktop(petId: string) {
  if (!petIdPattern.test(petId)) {
    return { error: "That pet could not be equipped." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in to equip a pet." };
  }

  const { error } = await supabase.rpc("equip_pet_to_desktop", {
    target_pet_id: petId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: "" };
}
