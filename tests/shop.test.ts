import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { STARTER_PET_TYPE, shopCatalog, shopPurchaseBlock } from "../lib/pets";
import { requiresAccount } from "../lib/routes";

test("shop purchases reject the starter and a second copy", () => {
  const owned = [STARTER_PET_TYPE];
  assert.equal(shopPurchaseBlock("lantern_moth", owned), "");
  assert.equal(shopPurchaseBlock("river_newt", owned), "");
  assert.equal(shopPurchaseBlock("baby_slime", owned), "That pet is not for sale.");
  assert.equal(shopPurchaseBlock("unknown", owned), "That pet is not for sale.");
  assert.equal(shopPurchaseBlock("lantern_moth", ["lantern_moth"]), "You already own that pet.");
  assert.equal(shopCatalog().some((pet) => pet.pet_type === "baby_slime"), false);
  assert.equal(shopCatalog().some((pet) => "price" in pet), false);
});

test("the shop and the desk require an account", () => {
  assert.equal(requiresAccount("/shop"), true);
  assert.equal(requiresAccount("/shop/extra"), true);
  assert.equal(requiresAccount("/dashboard"), true);
  assert.equal(requiresAccount("/dashboard/sessions/1"), true);
  assert.equal(requiresAccount("/"), false);
  assert.equal(requiresAccount("/login"), false);
  assert.equal(requiresAccount("/register"), false);
  assert.equal(requiresAccount("/privacy"), false);
  assert.equal(requiresAccount("/shopping"), false);
  assert.equal(requiresAccount("/inventory"), true);
  assert.equal(requiresAccount("/inventory/extra"), true);
  assert.equal(requiresAccount("/customize"), true);
  assert.equal(requiresAccount("/customize/extra"), true);

  const proxy = readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /requiresAccount\(pathname\)/);
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const publicHeader = readFileSync(
    new URL("../components/public-header.tsx", import.meta.url),
    "utf8",
  );
  assert.match(header, /href="\/shop"/);
  assert.doesNotMatch(header, /href="\/inventory"/);
  assert.doesNotMatch(publicHeader, /\/shop/);
  assert.doesNotMatch(publicHeader, /\/inventory/);
  const action = readFileSync(new URL("../lib/actions/pets.ts", import.meta.url), "utf8");
  assert.match(action, /shopPurchaseBlock/);
  assert.match(action, /purchase_pet/);
  assert.match(action, /revalidatePath\("\/shop"\)/);
  assert.match(action, /revalidatePath\("\/inventory"\)/);
  assert.match(action, /revalidatePath\("\/dashboard"\)/);

  const shop = readFileSync(new URL("../components/shop-screen.tsx", import.meta.url), "utf8");
  const marks = readFileSync(new URL("../components/pet-mark.tsx", import.meta.url), "utf8");
  assert.match(shop, /<PetMark petType=\{pet\.pet_type\}/);
  assert.match(marks, /petType === "lantern_moth"/);
  assert.match(marks, /petType === "river_newt"/);
  assert.doesNotMatch(shop, /SlimeMark/);
});
