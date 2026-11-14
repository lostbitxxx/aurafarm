"use server";

import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import {
  CREW_CODE_PATTERN,
  CREW_ID_PATTERN,
  crewOccupantsFromRows,
  farmCrewCardsFromRows,
  farmCrewDetailFromRows,
  farmCrewJoinRequestsFromRows,
  farmCrewMembersFromRows,
  farmCrewMessage,
  farmCrewRequestsFromRows,
  normalizeCrewCode,
  publicFarmCrewsFromRows,
  type CrewOccupant,
  type FarmCrewCard,
  type FarmCrewDetail,
  type FarmCrewJoinRequest,
  type FarmCrewMember,
  type FarmCrewRequest,
  type PublicFarmCrewCard,
} from "@/lib/farm-crew";
import { touchSocialPresence } from "@/lib/actions/friends";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function signedInClient() {
  await connection();
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return { error: "Sign in to use FarmCrew." };
  return { supabase };
}

function rows(value: unknown) {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export async function loadFarmCrewDialog(): Promise<{
  error: string;
  crews: FarmCrewCard[];
  publicCrews: PublicFarmCrewCard[];
  requests: FarmCrewRequest[];
}> {
  const client = await signedInClient();
  if ("error" in client) {
    return { error: client.error ?? "Sign in to use FarmCrew.", crews: [], publicCrews: [], requests: [] };
  }

  const [mine, open, waiting] = await Promise.all([
    client.supabase.rpc("list_my_farm_crews"),
    client.supabase.rpc("list_public_farm_crews"),
    client.supabase.rpc("list_farm_crew_requests"),
  ]);
  const error = mine.error ?? open.error ?? waiting.error;
  return {
    error: error ? farmCrewMessage(error.message) : "",
    crews: farmCrewCardsFromRows(rows(mine.data)),
    publicCrews: publicFarmCrewsFromRows(rows(open.data)),
    requests: farmCrewRequestsFromRows(rows(waiting.data)),
  };
}

export async function createFarmCrew(name: string, description: string, visibility: string) {
  if (visibility !== "public" && visibility !== "private") {
    return { error: "Choose public or private.", crewId: "" };
  }

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew.", crewId: "" };

  const { data, error } = await client.supabase.rpc("create_farm_crew", {
    input_name: name,
    input_description: description,
    input_public: visibility === "public",
  });
  if (error) return { error: farmCrewMessage(error.message), crewId: "" };

  revalidatePath("/dashboard");
  return { error: "", crewId: typeof data === "string" ? data : "" };
}

export async function requestFarmCrewByCode(code: string) {
  const normalized = normalizeCrewCode(code);
  if (!CREW_CODE_PATTERN.test(normalized)) return { error: "No FarmCrew uses that code.", crewName: "" };

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew.", crewName: "" };

  const { data, error } = await client.supabase.rpc("request_farm_crew_by_code", { target_code: normalized });
  if (error) return { error: farmCrewMessage(error.message), crewName: "" };
  return { error: "", crewName: typeof data === "string" ? data : "FarmCrew" };
}

export async function requestPublicFarmCrew(crewId: string) {
  if (!CREW_ID_PATTERN.test(crewId)) return { error: "This FarmCrew is not open.", crewName: "" };

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew.", crewName: "" };

  const { data, error } = await client.supabase.rpc("request_public_farm_crew", { target: crewId });
  if (error) return { error: farmCrewMessage(error.message), crewName: "" };
  return { error: "", crewName: typeof data === "string" ? data : "FarmCrew" };
}

export async function acceptFarmCrewRequest(crewId: string, userId: string) {
  if (!CREW_ID_PATTERN.test(crewId) || !CREW_ID_PATTERN.test(userId)) {
    return { error: "That request is no longer waiting." };
  }

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew." };

  const { error } = await client.supabase.rpc("accept_farm_crew_request", {
    target_crew: crewId,
    target_user: userId,
  });
  if (error) return { error: farmCrewMessage(error.message) };
  revalidatePath("/dashboard");
  revalidatePath(`/farmcrew/${crewId}`);
  return { error: "" };
}

export async function declineFarmCrewRequest(crewId: string, userId: string) {
  if (!CREW_ID_PATTERN.test(crewId) || !CREW_ID_PATTERN.test(userId)) {
    return { error: "That request is no longer waiting." };
  }

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew." };

  const { error } = await client.supabase.rpc("decline_farm_crew_request", {
    target_crew: crewId,
    target_user: userId,
  });
  if (error) return { error: farmCrewMessage(error.message) };
  return { error: "" };
}

export async function refreshFarmCrewRoom(crewId: string): Promise<{
  error: string;
  crew: FarmCrewDetail | null;
  occupants: CrewOccupant[];
}> {
  if (!CREW_ID_PATTERN.test(crewId)) {
    return { error: "This FarmCrew is not open to you.", crew: null, occupants: [] };
  }

  const client = await signedInClient();
  if ("error" in client) {
    return { error: client.error ?? "Sign in to use FarmCrew.", crew: null, occupants: [] };
  }

  await touchSocialPresence(true);
  const [crewResult, roomResult] = await Promise.all([
    client.supabase.rpc("get_farm_crew", { target: crewId }),
    client.supabase.rpc("list_farm_crew_room", { target: crewId }),
  ]);
  const error = crewResult.error ?? roomResult.error;
  if (error) return { error: farmCrewMessage(error.message), crew: null, occupants: [] };

  const crew = farmCrewDetailFromRows(rows(crewResult.data));
  if (!crew) return { error: "This FarmCrew is not open to you.", crew: null, occupants: [] };
  return { error: "", crew, occupants: crewOccupantsFromRows(rows(roomResult.data)) };
}

function crewTarget(crewId: string) {
  if (!CREW_ID_PATTERN.test(crewId)) return { error: "This FarmCrew is not open to you." };
  return { crewId };
}

export async function updateFarmCrewSettings(crewId: string, name: string, description: string, visibility: string) {
  const target = crewTarget(crewId);
  if ("error" in target) return { error: target.error ?? "This FarmCrew is not open to you." };
  if (visibility !== "public" && visibility !== "private") return { error: "Choose public or private." };

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew." };

  const { error } = await client.supabase.rpc("update_farm_crew_settings", {
    target: crewId,
    input_name: name,
    input_description: description,
    input_public: visibility === "public",
  });
  if (error) return { error: farmCrewMessage(error.message) };
  revalidatePath(`/farmcrew/${crewId}`);
  return { error: "" };
}

export async function loadFarmCrewMembers(crewId: string): Promise<{
  error: string;
  members: FarmCrewMember[];
  requests: FarmCrewJoinRequest[];
}> {
  const target = crewTarget(crewId);
  if ("error" in target) {
    return { error: target.error ?? "This FarmCrew is not open to you.", members: [], requests: [] };
  }

  const client = await signedInClient();
  if ("error" in client) {
    return { error: client.error ?? "Sign in to use FarmCrew.", members: [], requests: [] };
  }

  const [membersResult, requestsResult] = await Promise.all([
    client.supabase.rpc("list_farm_crew_members", { target: crewId }),
    client.supabase.rpc("list_farm_crew_join_requests", { target: crewId }),
  ]);
  const error = membersResult.error ?? requestsResult.error;
  if (error) return { error: farmCrewMessage(error.message), members: [], requests: [] };
  return {
    error: "",
    members: farmCrewMembersFromRows(rows(membersResult.data)),
    requests: farmCrewJoinRequestsFromRows(rows(requestsResult.data)),
  };
}

export async function promoteFarmCrewMember(crewId: string, userId: string) {
  if (!CREW_ID_PATTERN.test(crewId) || !CREW_ID_PATTERN.test(userId)) {
    return { error: "That farmer is not in this FarmCrew." };
  }

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew." };

  const { error } = await client.supabase.rpc("promote_farm_crew_member", {
    target_crew: crewId,
    target_user: userId,
  });
  if (error) return { error: farmCrewMessage(error.message) };
  revalidatePath(`/farmcrew/${crewId}`);
  return { error: "" };
}

export async function kickFarmCrewMember(crewId: string, userId: string) {
  if (!CREW_ID_PATTERN.test(crewId) || !CREW_ID_PATTERN.test(userId)) {
    return { error: "That farmer is not in this FarmCrew." };
  }

  const client = await signedInClient();
  if ("error" in client) return { error: client.error ?? "Sign in to use FarmCrew." };

  const { error } = await client.supabase.rpc("kick_farm_crew_member", {
    target_crew: crewId,
    target_user: userId,
  });
  if (error) return { error: farmCrewMessage(error.message) };
  revalidatePath(`/farmcrew/${crewId}`);
  return { error: "" };
}
