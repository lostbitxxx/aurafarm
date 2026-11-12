import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProfileRecord } from "./pets";

type Writer = Pick<SupabaseClient, "from">;

export async function saveNewFarmer(
  writer: Writer,
  userId: string,
  displayName: string,
) {
  const { error: profileError } = await writer.from("profiles").upsert(
    buildProfileRecord(userId, displayName),
    // Older profiles keep an email column. Leave it out of this write instead of storing null.
    { onConflict: "id", defaultToNull: false },
  );
  if (profileError) return { error: profileError.message };
  return { error: "" };
}
