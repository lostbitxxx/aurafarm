import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { test } from "node:test";
import { previewRewards } from "../lib/collection-catalog";
import { WORN_HAT_IDS, wornHatAsset } from "../lib/pet-assets";

test("worn hats drop the catalogue ground shadow while catalogue art keeps it", () => {
  const catalogIds = previewRewards("hat").map((item) => item.id);
  assert.deepEqual([...WORN_HAT_IDS], catalogIds);
  assert.equal(WORN_HAT_IDS.length, 8);
  assert.equal(wornHatAsset("hat_a"), null);
  assert.equal(wornHatAsset(null), null);

  for (const id of WORN_HAT_IDS) {
    assert.equal(wornHatAsset(id), `/pet-assets/accessories/worn/hats/${id}.svg`);

    const wornPath = new URL(`../public/pet-assets/accessories/worn/hats/${id}.svg`, import.meta.url);
    const catalogPath = new URL(`../public/pet-assets/accessories/hats/${id}.svg`, import.meta.url);
    accessSync(wornPath, constants.R_OK);
    accessSync(catalogPath, constants.R_OK);

    const worn = readFileSync(wornPath, "utf8");
    const catalog = readFileSync(catalogPath, "utf8");
    assert.match(catalog, /fill="#34452d18"/);
    assert.match(catalog, /<ellipse/);
    assert.doesNotMatch(worn, /fill="#34452d18"/);
    assert.doesNotMatch(worn, /<ellipse/);
    assert.match(worn, /viewBox="0 0 42 42"/);
    assert.match(worn, /shape-rendering="crispEdges"/);
  }

  const renderer = readFileSync(new URL("../components/pixel-pet.tsx", import.meta.url), "utf8");
  assert.match(renderer, /wornHatAsset/);
  assert.match(renderer, /fittedHat/);
});
