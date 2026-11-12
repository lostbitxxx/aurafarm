export const STARTER_PET_TYPE = "baby_slime";
export const STARTER_PET_LEVEL = 1;
export const SHOP_PRICE = 100;

export function wholePoints(value: unknown) {
  const points = Number(value);
  return Number.isFinite(points) ? Math.trunc(points) : 0;
}

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
  xp: number;
  is_desktop_active: boolean;
  color: string | null;
  hat: string | null;
  clothes: string | null;
};

export function equippedPet(pets: readonly PetCard[]) {
  return pets.find((pet) => pet.is_desktop_active) ?? null;
}

const PET_COPY: Record<string, { name: string; note: string; price?: number }> = {
  baby_slime: {
    name: "Baby Slime",
    note: "A wobbly starter that sticks to the desktop.",
  },
  lantern_moth: {
    name: "Lantern Moth",
    note: "A small light that follows the desk.",
    price: SHOP_PRICE,
  },
  river_newt: {
    name: "River Newt",
    note: "A quiet swimmer from the farm stream.",
    price: SHOP_PRICE,
  },
};

export type ShopPet = {
  pet_type: string;
  name: string;
  note: string;
};

export function shopCatalog(): ShopPet[] {
  return Object.entries(PET_COPY).flatMap(([pet_type, pet]) =>
    pet.price === undefined
      ? []
      : [{ pet_type, name: pet.name, note: pet.note }],
  );
}

export function shopPurchaseBlock(petType: string, ownedTypes: string[]) {
  const pet = shopCatalog().find((item) => item.pet_type === petType);
  if (!pet) return "That pet is not for sale.";
  if (ownedTypes.includes(petType)) return "You already own that pet.";
  return "";
}

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

export function buildGodotFrameSrc(pet: { pet_type: string; level: number } | null) {
  if (!pet) return "/godot-game/index.html";
  const params = new URLSearchParams({
    pet: pet.pet_type,
    level: String(pet.level),
  });
  return `/godot-game/index.html?${params.toString()}`;
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
