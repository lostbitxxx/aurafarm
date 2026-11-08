import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { wholePoints } from "./pets";
import { createClient } from "./supabase/server";

export async function loadShop() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");

  const [{ data: profile }, petsResult] = await Promise.all([
    supabase.from("profiles").select("display_name, points").eq("id", userId).maybeSingle(),
    supabase.from("user_pets").select("pet_type").eq("user_id", userId),
  ]);

  return {
    displayName: profile?.display_name?.trim() || "Farmer",
    points: wholePoints(profile?.points),
    ownedTypes: (petsResult.data ?? []).map((pet) => String(pet.pet_type)),
    shopError: petsResult.error?.message ?? null,
  };
}
