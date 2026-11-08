"use server";

import { revalidatePath } from "next/cache";
import { shopPurchaseBlock } from "@/lib/pets";
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

export async function buyPet(petType: string) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) {
    return { error: "Sign in to buy a pet." };
  }

  const [{ data: profile }, petsResult] = await Promise.all([
    supabase.from("profiles").select("points").eq("id", userId).maybeSingle(),
    supabase.from("user_pets").select("pet_type").eq("user_id", userId),
  ]);
  if (petsResult.error) return { error: petsResult.error.message };

  const ownedTypes = (petsResult.data ?? []).map((pet) => String(pet.pet_type));
  const blocked = shopPurchaseBlock(petType, ownedTypes, Number(profile?.points));
  if (blocked) return { error: blocked };

  const { error } = await supabase.rpc("purchase_pet", {
    target_pet_type: petType,
  });
  if (error) {
    if (/already owned/i.test(error.message)) return { error: "You already own that pet." };
    if (/not enough points/i.test(error.message)) return { error: "You do not have enough points." };
    if (/not for sale/i.test(error.message)) return { error: "That pet is not for sale." };
    return { error: error.message };
  }

  revalidatePath("/shop");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { error: "" };
}
