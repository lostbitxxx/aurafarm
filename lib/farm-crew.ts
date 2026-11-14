import { sampleClothes, sampleColor, sampleHat, wornClothesAsset, wornHatAsset } from "./pet-assets";

export const CREW_CODE_PATTERN = /^[ABCDEFGHIJKLMNPQRSTUVWXYZ23456789]{8}$/;
export const CREW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CREW_PET_TYPES = new Set(["baby_slime", "lantern_moth", "river_newt"]);
const MIGRATION = "Run migrations 0039 and 0040 before using FarmCrew.";
const ADMIN_MIGRATION = "Run migration 0042 before managing a FarmCrew.";
const ROSTER_MIGRATION = "Run migration 0043 before reviewing FarmCrew members.";

export type FarmCrewRole = "owner" | "admin" | "member";

export type FarmCrewCard = {
  crewId: string;
  name: string;
  description: string;
  code: string;
  petType: string;
  color: string | null;
  memberCount: number;
  role: FarmCrewRole;
};

export type PublicFarmCrewCard = {
  crewId: string;
  name: string;
  description: string;
  petType: string;
  color: string | null;
  memberCount: number;
  requested: boolean;
};

export type FarmCrewRequest = {
  crewId: string;
  crewName: string;
  userId: string;
  displayName: string;
};

export type FarmCrewDetail = {
  crewId: string;
  name: string;
  description: string;
  petType: string;
  color: string | null;
  memberCount: number;
  isPublic: boolean;
  role: FarmCrewRole;
};

export type FarmCrewMember = {
  userId: string;
  displayName: string;
  role: FarmCrewRole;
  petType: string | null;
  color: string | null;
  hat: string | null;
  clothes: string | null;
};

export type FarmCrewJoinRequest = {
  userId: string;
  displayName: string;
  petType: string | null;
  color: string | null;
  hat: string | null;
  clothes: string | null;
};

export type FarmCrewRoom = {
  crew: FarmCrewDetail | null;
  occupants: CrewOccupant[];
  displayName: string;
  userId: string;
  error: string | null;
};

export type CrewOccupant = {
  farmerId: string;
  displayName: string;
  petType: string;
  color: string | null;
  hat: string | null;
  clothes: string | null;
  presence: "online" | "aurafarming";
};

export function normalizeCrewCode(value: string) {
  return value.trim().toUpperCase();
}

export function farmCrewMessage(message: string) {
  if (/list_farm_crew_join_requests/i.test(message)) {
    return ROSTER_MIGRATION;
  }
  if (
    /list_farm_crew_members|update_farm_crew_settings|promote_farm_crew_member|kick_farm_crew_member/i.test(message)
  ) {
    return ADMIN_MIGRATION;
  }
  if (/farm_crew|schema cache|list_my_farm_crews|list_public_farm_crews|Could not find the function/i.test(message)) {
    return MIGRATION;
  }
  const known = [
    "Name the FarmCrew.",
    "Shorten the description.",
    "No FarmCrew uses that code.",
    "You are already in this FarmCrew.",
    "Request already sent.",
    "That request is no longer waiting.",
    "You do not lead this FarmCrew.",
    "You do not manage this FarmCrew.",
    "That farmer is not in this FarmCrew.",
    "The owner stays in the crew.",
    "Admins can only remove members.",
    "That farmer is already an admin.",
    "You cannot remove yourself.",
    "This FarmCrew is not open.",
    "Not authenticated.",
    "Choose public or private.",
    "Could not create a FarmCrew.",
  ];
  return known.find((item) => message.includes(item)) ?? "FarmCrew could not be updated.";
}

export function crewRole(value: unknown): FarmCrewRole {
  if (value === "owner" || value === "admin") return value;
  return "member";
}

export function managesFarmCrew(role: FarmCrewRole) {
  return role === "owner" || role === "admin";
}

function crewPetType(value: unknown) {
  return typeof value === "string" && CREW_PET_TYPES.has(value) ? value : "baby_slime";
}

function crewText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function memberCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}

function equippedPet(row: Record<string, unknown>) {
  const petType = typeof row.pet_type === "string" && CREW_PET_TYPES.has(row.pet_type) ? row.pet_type : null;
  return {
    petType,
    color: sampleColor(row.pet_color),
    hat: wornHat(row.hat),
    clothes: wornClothes(row.clothes, petType ?? "baby_slime"),
  };
}

function wornClothes(value: unknown, petType: string) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (sampleClothes(value) || wornClothesAsset(value, petType)) return value;
  return null;
}

function wornHat(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (sampleHat(value) || wornHatAsset(value)) return value;
  return null;
}

export function farmCrewCardsFromRows(rows: readonly Record<string, unknown>[]): FarmCrewCard[] {
  return rows.flatMap((row) => {
    const crewId = typeof row.crew_id === "string" ? row.crew_id : "";
    if (!CREW_ID_PATTERN.test(crewId)) return [];
    const code = typeof row.crew_code === "string" ? row.crew_code : "";
    return [
      {
        crewId,
        name: crewText(row.name, "FarmCrew"),
        description: typeof row.description === "string" ? row.description.trim() : "",
        code: CREW_CODE_PATTERN.test(code) ? code : "",
        petType: crewPetType(row.pet_type),
        color: sampleColor(row.pet_color),
        memberCount: memberCount(row.member_count),
        role: crewRole(row.role),
      },
    ];
  });
}

export function publicFarmCrewsFromRows(rows: readonly Record<string, unknown>[]): PublicFarmCrewCard[] {
  return rows.flatMap((row) => {
    const crewId = typeof row.crew_id === "string" ? row.crew_id : "";
    if (!CREW_ID_PATTERN.test(crewId)) return [];
    return [
      {
        crewId,
        name: crewText(row.name, "FarmCrew"),
        description: typeof row.description === "string" ? row.description.trim() : "",
        petType: crewPetType(row.pet_type),
        color: sampleColor(row.pet_color),
        memberCount: memberCount(row.member_count),
        requested: row.requested === true,
      },
    ];
  });
}

export function farmCrewRequestsFromRows(rows: readonly Record<string, unknown>[]): FarmCrewRequest[] {
  return rows.flatMap((row) => {
    const crewId = typeof row.crew_id === "string" ? row.crew_id : "";
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    if (!CREW_ID_PATTERN.test(crewId) || !CREW_ID_PATTERN.test(userId)) return [];
    return [
      {
        crewId,
        crewName: crewText(row.crew_name, "FarmCrew"),
        userId,
        displayName: crewText(row.display_name, "Farmer"),
      },
    ];
  });
}

export function farmCrewDetailFromRows(rows: readonly Record<string, unknown>[]): FarmCrewDetail | null {
  const row = rows[0];
  if (!row) return null;
  const crewId = typeof row.crew_id === "string" ? row.crew_id : "";
  if (!CREW_ID_PATTERN.test(crewId)) return null;
  return {
    crewId,
    name: crewText(row.name, "FarmCrew"),
    description: typeof row.description === "string" ? row.description.trim() : "",
    petType: crewPetType(row.pet_type),
    color: sampleColor(row.pet_color),
    memberCount: memberCount(row.member_count),
    isPublic: row.is_public === true,
    role: crewRole(row.role),
  };
}

export function farmCrewMembersFromRows(rows: readonly Record<string, unknown>[]): FarmCrewMember[] {
  return rows.flatMap((row) => {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    if (!CREW_ID_PATTERN.test(userId)) return [];
    return [
      {
        userId,
        displayName: crewText(row.display_name, "Farmer"),
        role: crewRole(row.role),
        ...equippedPet(row),
      },
    ];
  });
}

export function farmCrewJoinRequestsFromRows(rows: readonly Record<string, unknown>[]): FarmCrewJoinRequest[] {
  return rows.flatMap((row) => {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    if (!CREW_ID_PATTERN.test(userId)) return [];
    return [
      {
        userId,
        displayName: crewText(row.display_name, "Farmer"),
        ...equippedPet(row),
      },
    ];
  });
}

export function crewOccupantsFromRows(rows: readonly Record<string, unknown>[]): CrewOccupant[] {
  return rows.flatMap((row) => {
    const farmerId = typeof row.farmer_id === "string" ? row.farmer_id : "";
    const presence = row.presence === "aurafarming" ? "aurafarming" : row.presence === "online" ? "online" : null;
    if (!CREW_ID_PATTERN.test(farmerId) || !presence) return [];
    const petType = crewPetType(row.pet_type);
    return [
      {
        farmerId,
        displayName: crewText(row.display_name, "Farmer"),
        petType,
        color: sampleColor(row.pet_color),
        hat: wornHat(row.hat),
        clothes: wornClothes(row.clothes, petType),
        presence,
      },
    ];
  });
}
