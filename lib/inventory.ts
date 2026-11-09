import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { wholePoints, type PetCard } from "./pets";
import { levelFromExperience, studyTimerMigrationMessage } from "./study";
import { createClient } from "./supabase/server";

export async function loadInventory() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");

  const [{ data: profile }, petsResult] = await Promise.all([
    supabase.from("profiles").select("display_name, points").eq("id", userId).maybeSingle(),
    supabase
      .from("user_pets")
      .select("id, pet_type, level, xp, is_desktop_active")
      .eq("user_id", userId)
      .order("id", { ascending: true }),
  ]);

  const pets: PetCard[] = (petsResult.data ?? []).map((pet) => {
    const xp = wholePoints(pet.xp);
    return {
      id: String(pet.id),
      pet_type: String(pet.pet_type),
      level: levelFromExperience(xp),
      xp,
      is_desktop_active: Boolean(pet.is_desktop_active),
    };
  });

  return {
    displayName: profile?.display_name?.trim() || "Farmer",
    points: wholePoints(profile?.points),
    pets,
    petsError: studyTimerMigrationMessage(petsResult.error?.message ?? null),
  };
}
