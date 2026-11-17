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
import { DEFAULT_STUDY_SECONDS, storedStudySeconds, type ActiveStudySession } from "./study";
import { createClient } from "./supabase/server";

export async function loadFarmCrewRoom(crewId: string): Promise<FarmCrewRoom> {
  await connection();
  const empty = {
    crew: null,
    occupants: [],
    displayName: "Farmer",
    userId: "",
    activeSession: null,
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
  const [crewResult, roomResult, sessionResult] = await Promise.all([
    supabase.rpc("get_farm_crew", { target: crewId }),
    supabase.rpc("list_farm_crew_room", { target: crewId }),
    supabase
      .from("study_sessions")
      .select("id, started_at, planned_seconds, use_desktop_pet")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const rawError = crewResult.error?.message ?? roomResult.error?.message ?? "";
  if (crewResult.error || roomResult.error) {
    return { crew: null, occupants: [], displayName, userId, activeSession: null, error: farmCrewMessage(rawError) };
  }

  const crew = farmCrewDetailFromRows(Array.isArray(crewResult.data) ? crewResult.data : []);
  if (!crew) {
    return { crew: null, occupants: [], displayName, userId, activeSession: null, error: "This FarmCrew is not open to you." };
  }

  return {
    crew,
    occupants: crewOccupantsFromRows(Array.isArray(roomResult.data) ? roomResult.data : []),
    displayName,
    userId,
    activeSession: activeSessionFromRow(sessionResult.data),
    error: null,
  };
}

function activeSessionFromRow(row: {
  id?: unknown;
  started_at?: unknown;
  planned_seconds?: unknown;
  use_desktop_pet?: unknown;
} | null): ActiveStudySession | null {
  if (!row || typeof row.id !== "string" || typeof row.started_at !== "string") return null;
  return {
    id: row.id,
    startedAt: row.started_at,
    plannedSeconds: storedStudySeconds(Number(row.planned_seconds)) ?? DEFAULT_STUDY_SECONDS,
    useDesktopPet: row.use_desktop_pet === true,
  };
}
