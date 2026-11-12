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
] as const;

export type SampleColorId = (typeof SAMPLE_COLORS)[number]["id"];
export type PetColor = SampleColorId;

export const PET_COLORS: readonly PetColor[] = SAMPLE_COLORS.map((color) => color.id);

export function sampleColor(value: unknown): SampleColorId | null {
  if (typeof value !== "string") return null;
  return SAMPLE_COLORS.some((color) => color.id === value) ? (value as SampleColorId) : null;
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

export function outfitFolder(hat: boolean, clothes: boolean) {
  const hatPart = hat ? "forest-hat" : "no-hat";
  const clothesPart = clothes ? "blue-vest" : "no-clothes";
  return `${hatPart}-${clothesPart}`;
}

export function petAssetPath(
  petType: string,
  pose: PetPose,
  options: { color?: PetColor; hat?: boolean; clothes?: boolean } = {},
) {
  const species = speciesForPetType(petType);
  const color = options.color ?? colorForPetType(petType);
  const folder = outfitFolder(Boolean(options.hat), Boolean(options.clothes));
  return `/pet-assets/pets/${species}/${color}/${folder}/${pose}.svg`;
}

export const ROOM_ASSET_PATH = "/pet-assets/room/living-room.svg";

export const ROOM_PLACEMENT_NOTE =
  "This arrangement stays in this browser. It is not saved to your account.";

export const ACCESSORY_NOTE = "Coming soon";

export const STREAK_LABEL = "Streak coming soon";

export const EQUIP_DURING_SESSION_NOTE =
  "You cannot switch the equipped pet while a study session is running. XP stays with the pet chosen when the session started.";
