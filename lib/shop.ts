import "server-only";
import { connection } from "next/server";
import { requireCustomizationComplete } from "./customization";
import { createClient } from "./supabase/server";

export async function loadShop() {
  await connection();
  const gate = await requireCustomizationComplete();
  const supabase = await createClient();
  const userId = gate.userId;

  const [{ data: profile }, petsResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("user_pets").select("pet_type").eq("user_id", userId),
  ]);

  return {
    displayName: profile?.display_name?.trim() || "Farmer",
    ownedTypes: (petsResult.data ?? []).map((pet) => String(pet.pet_type)),
    shopError: petsResult.error?.message ?? null,
  };
}
