/**
 * Centralized temporary visual mappings for the living-room redesign.
 * Catalog pet_type IDs, names, ownership, levels and XP stay unchanged.
 * Species here are artwork folders only (cat / bunny — no slime).
 */

export type PetSpecies = "cat" | "bunny";
export type PetPose = "idle" | "walk1" | "walk2" | "blush" | "wait" | "study1" | "study2";

/**
 * One id per color range. A lighter or darker shade of the same range is an SVG
 * fill change, not a new id and not a migration.
 */
export const SAMPLE_COLORS = [
  { id: "honey", name: "Honey" },
  { id: "apricot", name: "Apricot" },
  { id: "rose", name: "Rose" },
  { id: "coral", name: "Coral" },
  { id: "lavender", name: "Lavender" },
  { id: "sage", name: "Sage" },
  { id: "mint", name: "Mint" },
  { id: "sky", name: "Sky" },
  { id: "lemon", name: "Lemon" },
  { id: "slate", name: "Slate" },
  { id: "white", name: "White" },
  { id: "black", name: "Black" },
] as const;

export type SampleColorId = (typeof SAMPLE_COLORS)[number]["id"];
export type PetColor = SampleColorId;

export const PET_COLORS: readonly PetColor[] = SAMPLE_COLORS.map((color) => color.id);

export function sampleColor(value: unknown): SampleColorId | null {
  if (typeof value !== "string") return null;
  return SAMPLE_COLORS.some((color) => color.id === value) ? (value as SampleColorId) : null;
}

/**
 * hat_c through hat_j are already in the database. Adding one of them does not
 * need a migration. Copy the hat_a-* folders to hat_c-* (or the matching id)
 * under each pet color for cat and bunny, then edit those SVG files.
 * Copying hat_a-* already includes the clothes_a and clothes_b folders that sit
 * beside that hat, so a new hat does not need a clothes migration either.
 */
export const SAMPLE_HATS = [
  { id: "hat_a" },
  { id: "hat_b" },
  { id: "hat_c" },
  { id: "hat_d" },
  { id: "hat_e" },
  { id: "hat_f" },
  { id: "hat_g" },
  { id: "hat_h" },
  { id: "hat_i" },
  { id: "hat_j" },
] as const;

export type SampleHatId = (typeof SAMPLE_HATS)[number]["id"];

export function sampleHat(value: unknown): SampleHatId | null {
  if (typeof value !== "string") return null;
  return SAMPLE_HATS.some((hat) => hat.id === value) ? (value as SampleHatId) : null;
}

/**
 * clothes_c through clothes_j are already in the database. Adding one of them does not
 * need a migration. Copy the *-clothes_a folders to *-clothes_c (or the matching id)
 * under each pet color for cat and bunny, including no-hat, hat_a, and hat_b, then edit those SVG files.
 */
export const SAMPLE_CLOTHES = [
  { id: "clothes_a" },
  { id: "clothes_b" },
  { id: "clothes_c" },
  { id: "clothes_d" },
  { id: "clothes_e" },
  { id: "clothes_f" },
  { id: "clothes_g" },
  { id: "clothes_h" },
  { id: "clothes_i" },
  { id: "clothes_j" },
] as const;

export type SampleClothesId = (typeof SAMPLE_CLOTHES)[number]["id"];

export function sampleClothes(value: unknown): SampleClothesId | null {
  if (typeof value !== "string") return null;
  return SAMPLE_CLOTHES.some((clothes) => clothes.id === value) ? (value as SampleClothesId) : null;
}

/** Temporary frontend artwork mapping — not a database change. */
export const PET_TYPE_SPECIES: Record<string, PetSpecies> = {
  baby_slime: "cat",
  lantern_moth: "bunny",
  river_newt: "cat",
};

export const DEFAULT_PET_COLOR: Record<string, PetColor> = {
  baby_slime: "sage",
  lantern_moth: "lavender",
  river_newt: "honey",
};

export function speciesForPetType(petType: string): PetSpecies {
  return PET_TYPE_SPECIES[petType] ?? "cat";
}

export function colorForPetType(petType: string): PetColor {
  return DEFAULT_PET_COLOR[petType] ?? "sage";
}

export function outfitFolder(hat: string | null | undefined, clothes: string | null | undefined) {
  const hatPart = sampleHat(hat) ?? "no-hat";
  const clothesPart = sampleClothes(clothes) ?? "no-clothes";
  return `${hatPart}-${clothesPart}`;
}

export function petAssetPath(
  petType: string,
  pose: PetPose,
  options: { color?: PetColor; hat?: string | null; clothes?: string | null } = {},
) {
  const species = speciesForPetType(petType);
  const color = options.color ?? colorForPetType(petType);
  const folder = outfitFolder(options.hat, options.clothes);
  return `/pet-assets/pets/${species}/${color}/${folder}/${pose}.svg`;
}

export const ROOM_ASSET_PATH = "/pet-assets/room/living-room.svg";

export const ROOM_PLACEMENT_NOTE =
  "This arrangement stays in this browser. It is not saved to your account.";

export const ACCESSORY_NOTE = "Coming soon";

export const STREAK_LABEL = "Streak coming soon";

export const EQUIP_DURING_SESSION_NOTE =
  "You cannot switch the equipped pet while a study session is running. XP stays with the pet chosen when the session started.";
