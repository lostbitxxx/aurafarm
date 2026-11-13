import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COLLECTION_ACCESSORY_HINT,
  COLLECTION_ACCESSORY_PREVIEW_NOTE,
  COLLECTION_CLOTHES_CARDS,
  COLLECTION_COLOR_HINT,
  COLLECTION_HAT_CARDS,
  collectibleCatalogIds,
  collectionComingSoonMessage,
  collectionCountLabel,
  collectionNoneCard,
  collectionProgress,
  ownedPreviewRewards,
  previewRewards,
} from "../lib/collection-catalog";
import { SAMPLE_CLOTHES, SAMPLE_COLORS, SAMPLE_HATS } from "../lib/pet-assets";

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

test("collection dialog shows owned items, None for accessories, and a coming-soon footer", () => {
  const source = readFileSync(
    new URL("../components/dashboard-dialogs.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /ownedPreviewRewards\("hat", ownedHatIds\)/);
  assert.match(source, /ownedPreviewRewards\("clothes", ownedClothesIds\)/);
  assert.match(source, /SAMPLE_HATS.filter/);
  assert.match(source, /SAMPLE_CLOTHES.filter/);
  assert.match(source, /onApply\(item\.id\)/);
  assert.match(source, /collectionNoneCard/);
  assert.match(source, /onSelectNone/);
  assert.match(source, /setApplyHat\(\{ id: null \}\)/);
  assert.match(source, /setApplyClothes\(\{ id: null \}\)/);
  assert.match(source, /collectionComingSoonMessage/);
  assert.match(source, /collectionProgress/);
  assert.match(source, /collection-count/);
  assert.match(source, /You don't own any hats yet\./);
  assert.match(source, /You don't own any clothes yet\./);
  assert.doesNotMatch(source, /aria-disabled/);
  assert.doesNotMatch(source, /COLLECTION_HAT_CARDS/);
  assert.doesNotMatch(source, /COLLECTION_CLOTHES_CARDS/);
  assert.doesNotMatch(source, /collection-color-soon/);
  assert.doesNotMatch(source, /coming_soon/);
  assert.doesNotMatch(source, /More \{active\.emptyNoun\} are coming soon/);
  assert.deepEqual(
    ownedPreviewRewards("hat", ["little-gentleman-top-hat", "hat_a"]).map((item) => item.id),
    ["little-gentleman-top-hat"],
  );
  assert.deepEqual(ownedPreviewRewards("clothes", []), []);
});

test("collection progress counts owned catalog items and excludes None and placeholders", () => {
  const none = collectionNoneCard();
  assert.equal(none.name, "None");
  assert.equal(none.icon, "/pet-assets/accessories/none.svg");
  assert.equal(collectionComingSoonMessage("color"), "More colors are coming soon.");
  assert.equal(collectionComingSoonMessage("hat"), "More hats are coming soon.");
  assert.equal(collectionComingSoonMessage("clothes"), "More clothes are coming soon.");

  assert.equal(collectibleCatalogIds("color").length, SAMPLE_COLORS.length);
  assert.equal(
    collectibleCatalogIds("hat").length,
    SAMPLE_HATS.length + previewRewards("hat").length,
  );
  assert.equal(
    collectibleCatalogIds("clothes").length,
    SAMPLE_CLOTHES.length + previewRewards("clothes").length,
  );
  assert.equal(collectibleCatalogIds("hat").includes("none"), false);
  assert.equal(collectibleCatalogIds("hat").includes("hat-coming-soon-1"), false);

  const hats = collectionProgress("hat", [
    "little-gentleman-top-hat",
    "little-gentleman-top-hat",
    "hat_a",
    "not-a-real-hat",
    "none",
  ]);
  assert.deepEqual(hats, { owned: 2, total: SAMPLE_HATS.length + previewRewards("hat").length });
  assert.equal(collectionCountLabel("hat", 2, hats!.total), `2 of ${hats!.total} hats collected`);

  const colors = collectionProgress("color", ["rose", "ink"]);
  assert.deepEqual(colors, { owned: 1, total: SAMPLE_COLORS.length });
  assert.deepEqual(collectionProgress("clothes", []), {
    owned: 0,
    total: SAMPLE_CLOTHES.length + previewRewards("clothes").length,
  });
});
