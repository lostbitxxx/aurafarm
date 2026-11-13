import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COLLECTION_ACCESSORY_HINT,
  COLLECTION_ACCESSORY_PREVIEW_NOTE,
  COLLECTION_CLOTHES_CARDS,
  COLLECTION_COLOR_HINT,
  COLLECTION_HAT_CARDS,
  ownedPreviewRewards,
} from "../lib/collection-catalog";
import { SAMPLE_CLOTHES, SAMPLE_HATS } from "../lib/pet-assets";

function assertTwelveCardShape(
  cards: typeof COLLECTION_HAT_CARDS,
  approvedNames: string[],
) {
  assert.equal(cards.length, 12);
  assert.equal(cards[0]?.kind, "none");
  assert.equal(cards[0]?.name, "None");
  const previews = cards.filter((card) => card.kind === "preview");
  const soon = cards.filter((card) => card.kind === "coming_soon");
  assert.equal(previews.length, 8);
  assert.equal(soon.length, 3);
  assert.deepEqual(
    previews.map((card) => card.name),
    approvedNames,
  );
  assert.ok(soon.every((card) => card.name === "Coming soon"));
  for (const card of cards) {
    if (card.kind === "preview" || card.kind === "none" || card.kind === "coming_soon") {
      const path = new URL(`../public${card.icon}`, import.meta.url);
      accessSync(path, constants.R_OK);
    }
  }
}

test("hat collection shows None, eight approved designs, and three coming soon", () => {
  assertTwelveCardShape(COLLECTION_HAT_CARDS, [
    "Little Gentleman: Top Hat",
    "Summer Garden: Straw Hat",
    "Flower Day: Daisy Clip",
    "Lucky Heart: Clover Clip",
    "Sleepy Companion: Nightcap",
    "Little Artist: Beret",
    "Forest Mushroom: Mushroom Cap",
    "Little Wizard: Star Hat",
  ]);
});

test("clothes collection shows None, eight approved designs, and three coming soon", () => {
  assertTwelveCardShape(COLLECTION_CLOTHES_CARDS, [
    "Little Gentleman: Suit",
    "Summer Garden: Vest",
    "Flower Day: Dress",
    "Lucky Heart: Heart Shorts",
    "Sleepy Companion: Star Pajamas",
    "Little Artist: Paint Apron",
    "Forest Mushroom: Woodland Vest",
    "Little Wizard: Wizard Robe",
  ]);
});

test("presentation catalogs stay separate from equippable legacy ids", () => {
  const legacy = new Set([...SAMPLE_HATS, ...SAMPLE_CLOTHES].map((item) => item.id));
  for (const card of [...COLLECTION_HAT_CARDS, ...COLLECTION_CLOTHES_CARDS]) {
    assert.equal(legacy.has(card.id), false);
    assert.doesNotMatch(card.id, /^hat_[a-j]$/);
    assert.doesNotMatch(card.id, /^clothes_[a-j]$/);
  }
  assert.match(COLLECTION_COLOR_HINT, /color you own/);
  assert.match(COLLECTION_ACCESSORY_HINT, /Mix and match hats and clothes/);
  assert.match(COLLECTION_ACCESSORY_PREVIEW_NOTE, /Preview only/);
});

test("collection dialog shows only owned hats and clothes", () => {
  const source = readFileSync(
    new URL("../components/dashboard-dialogs.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /ownedPreviewRewards\("hat", ownedHatIds\)/);
  assert.match(source, /ownedPreviewRewards\("clothes", ownedClothesIds\)/);
  assert.match(source, /SAMPLE_HATS.filter/);
  assert.match(source, /SAMPLE_CLOTHES.filter/);
  assert.doesNotMatch(source, /COLLECTION_HAT_CARDS/);
  assert.doesNotMatch(source, /COLLECTION_CLOTHES_CARDS/);
  assert.doesNotMatch(source, /collection-color-soon/);
  assert.doesNotMatch(source, /coming_soon/);
  assert.deepEqual(
    ownedPreviewRewards("hat", ["little-gentleman-top-hat", "hat_a"]).map((item) => item.id),
    ["little-gentleman-top-hat"],
  );
  assert.deepEqual(ownedPreviewRewards("clothes", []), []);
});
