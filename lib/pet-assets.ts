/**
 * Centralized temporary visual mappings for the living-room redesign.
 * Catalog pet_type IDs, names, ownership, levels and XP stay unchanged.
 * Species here are artwork folders only (cat / bunny — no slime).
 *
 * Pets are layered SVGs stacked at render time:
 * shadow → legs → body → clothes → face → hat
 * Study adds floor + chair behind and desk + pen in front.
 * Lobby sit uses the same chair/pens with a lobby-styled desk.
 */

export type PetSpecies = "cat" | "bunny";
export type PetPose = "idle" | "walk1" | "walk2" | "blush" | "struggle" | "wait" | "study1" | "study2";
export type PetLegMode = "stand" | "left-up" | "right-up";
export type PetFaceMode = "normal" | "blush" | "struggle";

/**
 * One id per color range. A lighter or darker shade of the same range is an SVG
 * fill change, not a new id and not a migration.
 * Files: public/pet-assets/pets/{cat|bunny}/colors/{color}/
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
 * Sample hats. Ids stay hat_a and hat_b (database).
 * Display: public/pet-assets/accessories/hats/{id}.svg
 * Worn: public/pet-assets/accessories/worn/hats/{id}.svg
 */
export const SAMPLE_HATS = [
  {
    id: "hat_a",
    name: "Forest Ranger: Green Hat",
    icon: "/pet-assets/accessories/hats/hat_a.svg",
  },
  {
    id: "hat_b",
    name: "Sky Explorer: Blue Hat",
    icon: "/pet-assets/accessories/hats/hat_b.svg",
  },
] as const;

export type SampleHatId = (typeof SAMPLE_HATS)[number]["id"];

export function sampleHat(value: unknown): SampleHatId | null {
  if (typeof value !== "string") return null;
  return SAMPLE_HATS.some((hat) => hat.id === value) ? (value as SampleHatId) : null;
}

/**
 * Sample clothes. Ids stay clothes_a and clothes_b (database).
 * Display: public/pet-assets/accessories/clothes/{id}.svg
 * Worn: public/pet-assets/accessories/worn/{id}/{cat|bunny}.svg
 */
export const SAMPLE_CLOTHES = [
  {
    id: "clothes_a",
    name: "Sky Explorer: Blue Vest",
    icon: "/pet-assets/accessories/clothes/clothes_a.svg",
  },
  {
    id: "clothes_b",
    name: "Forest Ranger: Brown Vest",
    icon: "/pet-assets/accessories/clothes/clothes_b.svg",
  },
] as const;

export type SampleClothesId = (typeof SAMPLE_CLOTHES)[number]["id"];

export function sampleClothes(value: unknown): SampleClothesId | null {
  if (typeof value !== "string") return null;
  return SAMPLE_CLOTHES.some((clothes) => clothes.id === value) ? (value as SampleClothesId) : null;
}

export function sampleAccessoryName(kind: "hat" | "clothes", id: string | null | undefined) {
  if (!id) return null;
  const items = kind === "hat" ? SAMPLE_HATS : SAMPLE_CLOTHES;
  return items.find((item) => item.id === id)?.name ?? null;
}

/** Standalone Collection / reward thumbnail (not the worn overlay). */
export function sampleAccessoryIcon(kind: "hat" | "clothes", id: string | null | undefined) {
  if (!id) return null;
  const items = kind === "hat" ? SAMPLE_HATS : SAMPLE_CLOTHES;
  return items.find((item) => item.id === id)?.icon ?? null;
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

/** The eight approved collection hats with worn overlays (catalogue art minus ground shadow). */
export const WORN_HAT_IDS = [
  "little-gentleman-top-hat",
  "summer-garden-straw-hat",
  "flower-day-daisy-clip",
  "lucky-heart-clover-clip",
  "sleepy-companion-nightcap",
  "little-artist-beret",
  "forest-mushroom-mushroom-cap",
  "little-wizard-star-hat",
] as const;

const WORN_HAT_ID_SET = new Set<string>(WORN_HAT_IDS);
const SAMPLE_HAT_ID_SET = new Set<string>(SAMPLE_HATS.map((hat) => hat.id));

/**
 * Worn hat overlays for sample + approved collection hats.
 * Catalogue icons live under accessories/hats/; worn art drops the ground shadow.
 */
export function wornHatAsset(hatId: string | null | undefined): string | null {
  if (!hatId) return null;
  if (SAMPLE_HAT_ID_SET.has(hatId) || WORN_HAT_ID_SET.has(hatId)) {
    return `/pet-assets/accessories/worn/hats/${hatId}.svg`;
  }
  return null;
}

/** The eight approved collection clothes with compact worn overlays. */
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
const SAMPLE_CLOTHES_ID_SET = new Set<string>(SAMPLE_CLOTHES.map((item) => item.id));

/**
 * Body-fitted worn overlays for sample + approved clothes.
 * Aligned to the clothes_a belly band so face, cheeks, and feet stay clear.
 */
export function wornClothesAsset(clothesId: string | null | undefined, petType: string): string | null {
  if (!clothesId) return null;
  if (!SAMPLE_CLOTHES_ID_SET.has(clothesId) && !WORN_CLOTHES_ID_SET.has(clothesId)) return null;
  const species = speciesForPetType(petType);
  return `/pet-assets/accessories/worn/${clothesId}/${species}.svg`;
}

export function colorForPetType(petType: string): PetColor {
  return DEFAULT_PET_COLOR[petType] ?? "sage";
}

export function petColorDir(species: PetSpecies, color: PetColor) {
  return `/pet-assets/pets/${species}/colors/${color}`;
}

export function legModeForPose(pose: PetPose): PetLegMode {
  if (pose === "walk2" || pose === "study2") return "right-up";
  if (pose === "walk1" || pose === "wait" || pose === "study1") return "left-up";
  return "stand";
}

export function faceModeForPose(pose: PetPose): PetFaceMode {
  if (pose === "blush") return "blush";
  if (pose === "struggle") return "struggle";
  return "normal";
}

export function isStudyPose(pose: PetPose) {
  return pose === "study1" || pose === "study2";
}

export type PetStackLayers = {
  stage: "pet" | "study";
  /** Under legs on the pet stage; omitted during study (floor replaces it). */
  shadow: string | null;
  legs: string;
  body: string;
  clothes: string | null;
  face: string;
  hat: string | null;
  floor: string | null;
  chair: string | null;
  desk: string | null;
  pen: string | null;
};

/**
 * Layer paths for stacking a dressed pet.
 * Order (back → front): floor?, chair?, shadow?, legs, body, clothes?, face, hat?, desk?, pen?
 */
export function petStackLayers(
  petType: string,
  pose: PetPose,
  options: {
    color?: PetColor;
    hat?: string | null;
    clothes?: string | null;
    /** When false, study poses keep pose limbs/face but skip desk/chair/floor props. */
    studyFurniture?: boolean;
    /** Lobby seat sit: chair + lobby desk + pens (no floor mat). */
    lobbyDesk?: boolean;
  } = {},
): PetStackLayers {
  const species = speciesForPetType(petType);
  const color = options.color ?? colorForPetType(petType);
  const base = petColorDir(species, color);
  const legs = legModeForPose(pose);
  const face = faceModeForPose(pose);
  const study = isStudyPose(pose);
  const furniture = options.studyFurniture !== false;
  const lobbyDesk = options.lobbyDesk === true;
  const clothes = wornClothesAsset(options.clothes, petType);
  const hat = wornHatAsset(options.hat);
  const showStudyProps = study && furniture;
  const desk = !showStudyProps
    ? null
    : lobbyDesk
      ? "/pet-assets/props/study/desk-long.svg"
      : "/pet-assets/props/study/desk.svg";

  return {
    stage: study ? "study" : "pet",
    shadow: study ? null : `${base}/shadow.svg`,
    legs: `${base}/legs/${legs}.svg`,
    body: `${base}/body.svg`,
    clothes,
    face: `${base}/face/${face}.svg`,
    hat,
    floor: showStudyProps && !lobbyDesk ? "/pet-assets/props/study/floor.svg" : null,
    chair: showStudyProps ? "/pet-assets/props/study/chair.svg" : null,
    desk,
    pen: showStudyProps ? `/pet-assets/props/study/pen-${pose === "study2" ? "2" : "1"}.svg` : null,
  };
}

/**
 * Body-layer path for the pet's color (pose and accessories are separate layers).
 * Prefer petStackLayers for rendering.
 */
export function petAssetPath(
  petType: string,
  _pose: PetPose,
  options: { color?: PetColor; hat?: string | null; clothes?: string | null } = {},
) {
  const species = speciesForPetType(petType);
  const color = options.color ?? colorForPetType(petType);
  return `${petColorDir(species, color)}/body.svg`;
}

/** @deprecated Combo outfit folders are gone; accessories are overlays. */
export function outfitFolder(hat: string | null | undefined, clothes: string | null | undefined) {
  const hatPart = sampleHat(hat) ?? "no-hat";
  const clothesPart = sampleClothes(clothes) ?? "no-clothes";
  return `${hatPart}-${clothesPart}`;
}

/** Full composite room art (crew room and any single-image use). */
export const ROOM_ASSET_PATH = "/pet-assets/room/living-room.svg";

/** Layered desk room pieces (wall / floor / carpet / furniture folders). */
export {
  ROOM_CARPET_SRC,
  ROOM_FLOOR_SRC,
  ROOM_FURNITURE,
  ROOM_TRIM_SRC,
  ROOM_WALL_SRC,
} from "@/lib/living-room-layout";


export const ROOM_PLACEMENT_NOTE =
  "This arrangement stays in this browser. It is not saved to your account.";

export const ACCESSORY_NOTE = "Coming soon";

export const STREAK_LABEL = "Streak coming soon";

export function streakPillLabel(streakCount: number | null | undefined) {
  if (typeof streakCount !== "number" || !Number.isFinite(streakCount)) {
    return STREAK_LABEL;
  }
  const safe = Math.max(0, Math.floor(streakCount));
  return safe === 1 ? "1 day" : `${safe} days`;
}

export const EQUIP_DURING_SESSION_NOTE = "You cannot switch equipped pet while studying!";

/** Pixel heart for petting FX and the Pet button. */
export const PIXEL_HEART_SRC = "/pet-assets/ui/pixel-heart.svg";
