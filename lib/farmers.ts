import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProfileRecord, buildStarterPetRecord } from "./pets";

type Writer = Pick<SupabaseClient, "from">;

export async function saveNewFarmer(
  writer: Writer,
  userId: string,
  displayName: string,
) {
  const { error: profileError } = await writer.from("profiles").upsert(
    buildProfileRecord(userId, displayName),
    { onConflict: "id" },
  );
  if (profileError) return { error: profileError.message };

  const { data: existing, error: existingError } = await writer
    .from("user_pets")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existingError) return { error: existingError.message };
  if (existing && existing.length > 0) return { error: "" };

  const { error: petError } = await writer
    .from("user_pets")
    .insert(buildStarterPetRecord(userId));

  if (petError && petError.code !== "23505") return { error: petError.message };
  return { error: "" };
}
