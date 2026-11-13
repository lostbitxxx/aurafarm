"use server";

import { revalidatePath } from "next/cache";
import { sampleClothes, sampleColor, sampleHat } from "@/lib/pet-assets";
import { highestPetLevel, shopPurchaseBlock, wholePoints } from "@/lib/pets";
import { levelFromExperience } from "@/lib/study";
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
  revalidatePath("/inventory");
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

  const petsResult = await supabase.from("user_pets").select("pet_type, xp").eq("user_id", userId);
  if (petsResult.error) return { error: petsResult.error.message };

  const ownedTypes = (petsResult.data ?? []).map((pet) => String(pet.pet_type));
  const reachedLevel = highestPetLevel(
    (petsResult.data ?? []).map((pet) => levelFromExperience(wholePoints(pet.xp))),
  );
  const blocked = shopPurchaseBlock(petType, ownedTypes, reachedLevel);
  if (blocked) return { error: blocked };

  const { error } = await supabase.rpc("purchase_pet", {
    target_pet_type: petType,
  });
  if (error) {
    if (/already owned/i.test(error.message)) return { error: "You already own that pet." };
    if (/not for sale/i.test(error.message)) return { error: "That pet is not for sale." };
    const locked = error.message.match(/reach level (\d+)/i);
    if (locked) return { error: `Reach level ${locked[1]} to unlock this pet.` };
    return { error: error.message };
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { error: "" };
}

export async function applyPetColor(petId: string, colorId: string) {
  if (!petIdPattern.test(petId) || !sampleColor(colorId)) {
    return { error: "That color could not be applied." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in to apply a color." };
  }

  const { error } = await supabase.rpc("apply_pet_color", {
    target_pet_id: petId,
    target_color: colorId,
  });
  if (error) {
    if (/not owned/i.test(error.message)) return { error: "You do not own that color." };
    if (/not found/i.test(error.message)) return { error: "That pet could not be found." };
    if (/not in the collection/i.test(error.message)) return { error: "That color could not be applied." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: "" };
}

export async function applyPetHat(petId: string, hatId: string | null) {
  if (!petIdPattern.test(petId) || (hatId !== null && !sampleHat(hatId))) {
    return { error: "That hat could not be applied." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in to apply a hat." };
  }

  const { error } = await supabase.rpc("apply_pet_hat", {
    target_pet_id: petId,
    target_hat: hatId,
  });
  if (error) {
    if (/not owned/i.test(error.message)) return { error: "You do not own that hat." };
    if (/not found/i.test(error.message)) return { error: "That pet could not be found." };
    if (/not in the collection/i.test(error.message)) return { error: "That hat could not be applied." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: "" };
}

export async function applyPetClothes(petId: string, clothesId: string | null) {
  if (!petIdPattern.test(petId) || (clothesId !== null && !sampleClothes(clothesId))) {
    return { error: "Those clothes could not be applied." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in to apply clothes." };
  }

  const { error } = await supabase.rpc("apply_pet_clothes", {
    target_pet_id: petId,
    target_clothes: clothesId,
  });
  if (error) {
    if (/not owned/i.test(error.message)) return { error: "You do not own those clothes." };
    if (/not found/i.test(error.message)) return { error: "That pet could not be found." };
    if (/not in the collection/i.test(error.message)) return { error: "Those clothes could not be applied." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: "" };
}

export async function claimCollectionReward(itemId: string) {
  if (!sampleColor(itemId) && !sampleHat(itemId) && !sampleClothes(itemId)) {
    return { error: "That item could not be chosen." };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return { error: "Sign in to choose a reward." };
  }

  const { error } = await supabase.rpc("claim_collection_reward", {
    target_item: itemId,
  });
  if (error) {
    if (/collection_rewards|claim_collection_reward/i.test(error.message)) {
      return { error: "Run migration 0024 before choosing a level reward." };
    }
    if (/already owned/i.test(error.message)) return { error: "You already own that item." };
    if (/no reward to claim/i.test(error.message)) return { error: "You do not have a reward to choose." };
    if (/not in the collection/i.test(error.message)) return { error: "That item could not be chosen." };
    if (/not authenticated/i.test(error.message)) return { error: "Sign in to choose a reward." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: "" };
}
