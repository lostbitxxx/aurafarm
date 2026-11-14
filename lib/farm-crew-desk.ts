import "server-only";
import { connection } from "next/server";
import { touchSocialPresence } from "./actions/friends";
import {
  CREW_ID_PATTERN,
  crewOccupantsFromRows,
  farmCrewDetailFromRows,
  farmCrewMessage,
  type FarmCrewRoom,
} from "./farm-crew";
import { createClient } from "./supabase/server";

export async function loadFarmCrewRoom(crewId: string): Promise<FarmCrewRoom> {
  await connection();
  const empty = {
    crew: null,
    occupants: [],
    displayName: "Farmer",
    userId: "",
    error: "Sign in to visit a FarmCrew.",
  };
  if (!CREW_ID_PATTERN.test(crewId)) {
    return { ...empty, error: "This FarmCrew is not open to you." };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (claimsError || !userId) return empty;

  const profile = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const displayName =
    typeof profile.data?.display_name === "string" && profile.data.display_name.trim()
      ? profile.data.display_name.trim()
      : "Farmer";

  await touchSocialPresence(true);
  const [crewResult, roomResult] = await Promise.all([
    supabase.rpc("get_farm_crew", { target: crewId }),
    supabase.rpc("list_farm_crew_room", { target: crewId }),
  ]);
  const rawError = crewResult.error?.message ?? roomResult.error?.message ?? "";
  if (crewResult.error || roomResult.error) {
    return { crew: null, occupants: [], displayName, userId, error: farmCrewMessage(rawError) };
  }

  const crew = farmCrewDetailFromRows(Array.isArray(crewResult.data) ? crewResult.data : []);
  if (!crew) {
    return { crew: null, occupants: [], displayName, userId, error: "This FarmCrew is not open to you." };
  }

  return {
    crew,
    occupants: crewOccupantsFromRows(Array.isArray(roomResult.data) ? roomResult.data : []),
    displayName,
    userId,
    error: null,
  };
}
