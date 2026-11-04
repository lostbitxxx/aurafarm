export const STARTER_PET_TYPE = "baby_slime";
export const STARTER_PET_LEVEL = 1;

export type ProfileRecord = {
  id: string;
  display_name: string;
};

export type StarterPetRecord = {
  user_id: string;
  pet_type: typeof STARTER_PET_TYPE;
  level: number;
  is_desktop_active: true;
};

export type PetCard = {
  id: string;
  pet_type: string;
  level: number;
  is_desktop_active: boolean;
};

const PET_COPY: Record<string, { name: string; note: string }> = {
  baby_slime: {
    name: "Baby Slime",
    note: "A wobbly starter that sticks to the desktop.",
  },
};

export function buildProfileRecord(userId: string, displayName: string): ProfileRecord {
  return {
    id: userId,
    display_name: displayName,
  };
}

export function buildStarterPetRecord(userId: string): StarterPetRecord {
  return {
    user_id: userId,
    pet_type: STARTER_PET_TYPE,
    level: STARTER_PET_LEVEL,
    is_desktop_active: true,
  };
}

export function describePet(petType: string) {
  const known = PET_COPY[petType];
  if (known) return known;

  const name = petType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    name: name || "Pet",
    note: "A companion from your farm.",
  };
}
