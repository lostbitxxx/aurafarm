/**
 * Hats and clothes shown in Collection and the level-up reward picker.
 * Kept separate from SAMPLE_HATS / SAMPLE_CLOTHES. The eight approved designs
 * can be owned as a reward and applied to a pet.
 */

export const COLLECTION_ACCESSORY_HINT =
  "Mix and match hats and clothes to create your own look.";

export const COLLECTION_ACCESSORY_PREVIEW_NOTE = "Preview only · Equipping coming soon";

export const COLLECTION_COLOR_HINT = "A color you own can be applied to any pet.";

export type CollectionAccessoryCard =
  | {
      kind: "none";
      id: "none";
      name: "None";
      icon: string;
    }
  | {
      kind: "preview";
      id: string;
      name: string;
      icon: string;
    }
  | {
      kind: "coming_soon";
      id: string;
      name: "Coming soon";
      icon: string;
    };

const NONE_ICON = "/pet-assets/accessories/none.svg";
const COMING_SOON_ICON = "/pet-assets/accessories/coming-soon.svg";

export const COLLECTION_HAT_CARDS: readonly CollectionAccessoryCard[] = [
  { kind: "none", id: "none", name: "None", icon: NONE_ICON },
  {
    kind: "preview",
    id: "little-gentleman-top-hat",
    name: "Little Gentleman: Top Hat",
    icon: "/pet-assets/accessories/hats/little-gentleman-top-hat.svg",
  },
  {
    kind: "preview",
    id: "summer-garden-straw-hat",
    name: "Summer Garden: Straw Hat",
    icon: "/pet-assets/accessories/hats/summer-garden-straw-hat.svg",
  },
  {
    kind: "preview",
    id: "flower-day-daisy-clip",
    name: "Flower Day: Daisy Clip",
    icon: "/pet-assets/accessories/hats/flower-day-daisy-clip.svg",
  },
  {
    kind: "preview",
    id: "lucky-heart-clover-clip",
    name: "Lucky Heart: Clover Clip",
    icon: "/pet-assets/accessories/hats/lucky-heart-clover-clip.svg",
  },
  {
    kind: "preview",
    id: "sleepy-companion-nightcap",
    name: "Sleepy Companion: Nightcap",
    icon: "/pet-assets/accessories/hats/sleepy-companion-nightcap.svg",
  },
  {
    kind: "preview",
    id: "little-artist-beret",
    name: "Little Artist: Beret",
    icon: "/pet-assets/accessories/hats/little-artist-beret.svg",
  },
  {
    kind: "preview",
    id: "forest-mushroom-mushroom-cap",
    name: "Forest Mushroom: Mushroom Cap",
    icon: "/pet-assets/accessories/hats/forest-mushroom-mushroom-cap.svg",
  },
  {
    kind: "preview",
    id: "little-wizard-star-hat",
    name: "Little Wizard: Star Hat",
    icon: "/pet-assets/accessories/hats/little-wizard-star-hat.svg",
  },
  { kind: "coming_soon", id: "hat-coming-soon-1", name: "Coming soon", icon: COMING_SOON_ICON },
  { kind: "coming_soon", id: "hat-coming-soon-2", name: "Coming soon", icon: COMING_SOON_ICON },
  { kind: "coming_soon", id: "hat-coming-soon-3", name: "Coming soon", icon: COMING_SOON_ICON },
];

export const COLLECTION_CLOTHES_CARDS: readonly CollectionAccessoryCard[] = [
  { kind: "none", id: "none", name: "None", icon: NONE_ICON },
  {
    kind: "preview",
    id: "little-gentleman-suit",
    name: "Little Gentleman: Suit",
    icon: "/pet-assets/accessories/clothes/little-gentleman-suit.svg",
  },
  {
    kind: "preview",
    id: "summer-garden-vest",
    name: "Summer Garden: Vest",
    icon: "/pet-assets/accessories/clothes/summer-garden-vest.svg",
  },
  {
    kind: "preview",
    id: "flower-day-dress",
    name: "Flower Day: Dress",
    icon: "/pet-assets/accessories/clothes/flower-day-dress.svg",
  },
  {
    kind: "preview",
    id: "lucky-heart-heart-shorts",
    name: "Lucky Heart: Heart Shorts",
    icon: "/pet-assets/accessories/clothes/lucky-heart-heart-shorts.svg",
  },
  {
    kind: "preview",
    id: "sleepy-companion-star-pajamas",
    name: "Sleepy Companion: Star Pajamas",
    icon: "/pet-assets/accessories/clothes/sleepy-companion-star-pajamas.svg",
  },
  {
    kind: "preview",
    id: "little-artist-paint-apron",
    name: "Little Artist: Paint Apron",
    icon: "/pet-assets/accessories/clothes/little-artist-paint-apron.svg",
  },
  {
    kind: "preview",
    id: "forest-mushroom-woodland-vest",
    name: "Forest Mushroom: Woodland Vest",
    icon: "/pet-assets/accessories/clothes/forest-mushroom-woodland-vest.svg",
  },
  {
    kind: "preview",
    id: "little-wizard-wizard-robe",
    name: "Little Wizard: Wizard Robe",
    icon: "/pet-assets/accessories/clothes/little-wizard-wizard-robe.svg",
  },
  { kind: "coming_soon", id: "clothes-coming-soon-1", name: "Coming soon", icon: COMING_SOON_ICON },
  { kind: "coming_soon", id: "clothes-coming-soon-2", name: "Coming soon", icon: COMING_SOON_ICON },
  { kind: "coming_soon", id: "clothes-coming-soon-3", name: "Coming soon", icon: COMING_SOON_ICON },
];

export type PreviewReward = {
  kind: "hat" | "clothes";
  id: string;
  name: string;
  icon: string;
};

export function previewRewards(kind: "hat" | "clothes"): PreviewReward[] {
  const cards = kind === "hat" ? COLLECTION_HAT_CARDS : COLLECTION_CLOTHES_CARDS;
  return cards.flatMap((card) =>
    card.kind === "preview" ? [{ kind, id: card.id, name: card.name, icon: card.icon }] : [],
  );
}

export function previewReward(id: string): PreviewReward | null {
  return previewRewards("hat").find((item) => item.id === id) ?? previewRewards("clothes").find((item) => item.id === id) ?? null;
}

export function ownedPreviewRewards(kind: "hat" | "clothes", ownedIds: readonly string[]): PreviewReward[] {
  const owned = new Set(ownedIds);
  return previewRewards(kind).filter((item) => owned.has(item.id));
}
