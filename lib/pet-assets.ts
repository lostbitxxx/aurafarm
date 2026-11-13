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
 * Files: public/pet-assets/pets/{cat|bunny}/{color}/no-hat-no-clothes/{pose}.svg
 * A worn hat or clothes replaces no-hat or no-clothes in that folder name.
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
 * Files: public/pet-assets/pets/{cat|bunny}/{color}/hat_a-no-clothes/{pose}.svg
 * With clothes: public/pet-assets/pets/{cat|bunny}/{color}/hat_a-clothes_a/{pose}.svg
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
 * Files: public/pet-assets/pets/{cat|bunny}/{color}/no-hat-clothes_a/{pose}.svg
 * With a hat: public/pet-assets/pets/{cat|bunny}/{color}/hat_a-clothes_a/{pose}.svg
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

/** The eight approved collection clothes with compact worn overlays (clothes_a placement). */
export const WORN_CLOTHES_IDS = [
  "little-gentleman-suit",
  "summer-garden-vest",
  "flower-day-dress",
  "lucky-heart-heart-shorts",
  "sleepy-companion-star-pajamas",
  "little-artist-paint-apron",
  "forest-mushroom-woodland-vest",
  "little-wizard-wizard-robe",
] as const;

const WORN_CLOTHES_ID_SET = new Set<string>(WORN_CLOTHES_IDS);

/**
 * Body-fitted worn overlays for approved clothes (not catalogue thumbnails).
 * Aligned to the clothes_a belly band so face, cheeks, and feet stay clear.
 */
export function wornClothesAsset(clothesId: string | null | undefined, petType: string): string | null {
  if (!clothesId || !WORN_CLOTHES_ID_SET.has(clothesId)) return null;
  const species = speciesForPetType(petType);
  return `/pet-assets/accessories/worn/${clothesId}/${species}.svg`;
}

export function colorForPetType(petType: string): PetColor {
  return DEFAULT_PET_COLOR[petType] ?? "sage";
}

export function outfitFolder(hat: string | null | undefined, clothes: string | null | undefined) {
  const hatPart = sampleHat(hat) ?? "no-hat";
  const clothesPart = sampleClothes(clothes) ?? "no-clothes";
  return `${hatPart}-${clothesPart}`;
}

/**
 * Route for all three accessories:
 * /pet-assets/pets/{cat|bunny}/{color}/{hat}-{clothes}/{pose}.svg
 * The file is public/pet-assets/pets/{cat|bunny}/{color}/{hat}-{clothes}/{pose}.svg
 * color is the directory. hat is no-hat or hat_a through hat_j.
 * clothes is no-clothes or clothes_a through clothes_j.
 * pose is idle, walk1, walk2, blush, wait, study1, or study2.
 */
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
