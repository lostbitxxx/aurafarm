import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { test } from "node:test";
import { previewRewards } from "../lib/collection-catalog";
import { WORN_CLOTHES_IDS, wornClothesAsset } from "../lib/pet-assets";

test("all eight approved clothes have compact clothes_a-style worn overlays", () => {
  const catalogIds = previewRewards("clothes").map((item) => item.id);
  assert.deepEqual([...WORN_CLOTHES_IDS], catalogIds);
  assert.equal(WORN_CLOTHES_IDS.length, 8);
  assert.equal(WORN_CLOTHES_IDS.includes("none" as never), false);
  assert.equal(wornClothesAsset("clothes_a", "baby_slime"), null);
  assert.equal(wornClothesAsset("clothes_i", "baby_slime"), null);
  assert.equal(wornClothesAsset(null, "baby_slime"), null);

  for (const id of WORN_CLOTHES_IDS) {
    assert.equal(
      wornClothesAsset(id, "baby_slime"),
      `/pet-assets/accessories/worn/${id}/cat.svg`,
    );
    assert.equal(
      wornClothesAsset(id, "lantern_moth"),
      `/pet-assets/accessories/worn/${id}/bunny.svg`,
    );
    assert.equal(
      wornClothesAsset(id, "river_newt"),
      `/pet-assets/accessories/worn/${id}/cat.svg`,
    );

    for (const species of ["cat", "bunny"] as const) {
      const path = new URL(`../public/pet-assets/accessories/worn/${id}/${species}.svg`, import.meta.url);
      accessSync(path, constants.R_OK);
      const svg = readFileSync(path, "utf8");
      assert.match(svg, /viewBox="0 0 42 42"/);
      assert.match(svg, /shape-rendering="crispEdges"/);
      assert.match(svg, /M8 29/);
      assert.doesNotMatch(svg, /M5 23/);
      assert.doesNotMatch(svg, /M8 17/);
    }

    const catalog = readFileSync(
      new URL(`../public/pet-assets/accessories/clothes/${id}.svg`, import.meta.url),
      "utf8",
    );
    assert.match(catalog, /viewBox="0 0 42 42"/);
  }

  // Preserved approved designs stay distinct from newly added ones.
  const pajamas = readFileSync(
    new URL("../public/pet-assets/accessories/worn/sleepy-companion-star-pajamas/bunny.svg", import.meta.url),
    "utf8",
  );
  const woodland = readFileSync(
    new URL("../public/pet-assets/accessories/worn/forest-mushroom-woodland-vest/bunny.svg", import.meta.url),
    "utf8",
  );
  const robe = readFileSync(
    new URL("../public/pet-assets/accessories/worn/little-wizard-wizard-robe/bunny.svg", import.meta.url),
    "utf8",
  );
  const suit = readFileSync(
    new URL("../public/pet-assets/accessories/worn/little-gentleman-suit/bunny.svg", import.meta.url),
    "utf8",
  );
  const summer = readFileSync(
    new URL("../public/pet-assets/accessories/worn/summer-garden-vest/bunny.svg", import.meta.url),
    "utf8",
  );
  const dress = readFileSync(
    new URL("../public/pet-assets/accessories/worn/flower-day-dress/bunny.svg", import.meta.url),
    "utf8",
  );
  const shorts = readFileSync(
    new URL("../public/pet-assets/accessories/worn/lucky-heart-heart-shorts/bunny.svg", import.meta.url),
    "utf8",
  );
  const apron = readFileSync(
    new URL("../public/pet-assets/accessories/worn/little-artist-paint-apron/bunny.svg", import.meta.url),
    "utf8",
  );

  assert.match(pajamas, /#c9b6e0/);
  assert.match(woodland, /#6b8a59/);
  assert.match(robe, /#5c73a3/);
  assert.match(suit, /#2f3338/);
  assert.match(summer, /#8faf78/);
  assert.match(dress, /#f4d0da/);
  assert.match(shorts, /#c45c4a/);
  assert.match(apron, /#6e3a68/);

  const unique = new Set([pajamas, woodland, robe, suit, summer, dress, shorts, apron]);
  assert.equal(unique.size, 8);

  const renderer = readFileSync(new URL("../components/pixel-pet.tsx", import.meta.url), "utf8");
  assert.match(renderer, /wornClothesAsset/);
  assert.match(renderer, /is-worn-clothes/);
});
