import "server-only";
import { redirect } from "next/navigation";
import type { PetCard } from "./pets";
import { createClient } from "./supabase/server";

export async function loadDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");

  const [{ data: profile }, petsResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("user_pets")
      .select("id, pet_type, level, is_desktop_active")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const pets: PetCard[] = (petsResult.data ?? []).map((pet) => ({
    id: String(pet.id),
    pet_type: String(pet.pet_type),
    level: Number(pet.level),
    is_desktop_active: Boolean(pet.is_desktop_active),
  }));

  return {
    displayName: profile?.display_name?.trim() || "Farmer",
    pets,
    petsError: petsResult.error?.message ?? null,
  };
}
