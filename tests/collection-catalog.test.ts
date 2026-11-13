import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COLLECTION_ACCESSORY_HINT,
  COLLECTION_ACCESSORY_PREVIEW_NOTE,
  COLLECTION_CLOTHES_CARDS,
  COLLECTION_COLOR_HINT,
  COLLECTION_HAT_CARDS,
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
  const legacy = new Set<string>([...SAMPLE_HATS, ...SAMPLE_CLOTHES].map((item) => item.id));
  for (const card of [...COLLECTION_HAT_CARDS, ...COLLECTION_CLOTHES_CARDS]) {
    assert.equal(legacy.has(card.id), false);
    assert.doesNotMatch(card.id, /^hat_[a-j]$/);
    assert.doesNotMatch(card.id, /^clothes_[a-j]$/);
  }
  assert.match(COLLECTION_COLOR_HINT, /color you own/);
  assert.match(COLLECTION_ACCESSORY_HINT, /Mix and match hats and clothes/);
  assert.match(COLLECTION_ACCESSORY_PREVIEW_NOTE, /Preview only/);
});

test("collection dialog no longer lists legacy hat_a or clothes_a labels in the accessory grids", () => {
  const source = readFileSync(
    new URL("../components/dashboard-dialogs.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /COLLECTION_HAT_CARDS/);
  assert.match(source, /COLLECTION_CLOTHES_CARDS/);
  assert.match(source, /collection-color-soon/);
  assert.doesNotMatch(source, /ownedHats\.map/);
  assert.doesNotMatch(source, /ownedClothes\.map/);
  assert.doesNotMatch(source, /SAMPLE_HATS/);
  assert.doesNotMatch(source, /SAMPLE_CLOTHES/);
});
