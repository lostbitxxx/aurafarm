import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { STARTER_PET_TYPE, shopCatalog, shopPurchaseBlock } from "../lib/pets";
import { requiresAccount } from "../lib/routes";

test("shop pets unlock every two levels and reject a second copy", () => {
  const owned = [STARTER_PET_TYPE];
  assert.equal(shopPurchaseBlock("lantern_moth", owned, 1), "Reach level 2 to unlock this pet.");
  assert.equal(shopPurchaseBlock("river_newt", owned, 1), "Reach level 4 to unlock this pet.");
  assert.equal(shopPurchaseBlock("lantern_moth", owned, 2), "");
  assert.equal(shopPurchaseBlock("river_newt", owned, 2), "Reach level 4 to unlock this pet.");
  assert.equal(shopPurchaseBlock("river_newt", owned, 3), "Reach level 4 to unlock this pet.");
  assert.equal(shopPurchaseBlock("lantern_moth", owned, 4), "");
  assert.equal(shopPurchaseBlock("river_newt", owned, 4), "");
  assert.equal(shopPurchaseBlock("baby_slime", owned, 4), "That pet is not for sale.");
  assert.equal(shopPurchaseBlock("unknown", owned, 4), "That pet is not for sale.");
  assert.equal(shopPurchaseBlock("lantern_moth", ["lantern_moth"], 4), "You already own that pet.");
  assert.equal(shopCatalog().some((pet) => pet.pet_type === "baby_slime"), false);
  assert.equal(shopCatalog().some((pet) => "price" in pet), false);
  assert.deepEqual(
    shopCatalog().map((pet) => [pet.pet_type, pet.unlockLevel]),
    [
      ["lantern_moth", 2],
      ["river_newt", 4],
    ],
  );
});

test("the desk requires an account and the old shop page is gone", () => {
  assert.equal(requiresAccount("/shop"), false);
  assert.equal(requiresAccount("/shop/extra"), false);
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
  assert.match(header, /Shop/);
  assert.doesNotMatch(header, /href="\/shop"/);
  assert.doesNotMatch(header, /href="\/inventory"/);
  assert.match(header, /Collection/);
  assert.match(header, /Inventory/);
  assert.match(header, /Achievements/);
  assert.doesNotMatch(publicHeader, /\/shop/);
  assert.doesNotMatch(publicHeader, /\/inventory/);
  const action = readFileSync(new URL("../lib/actions/pets.ts", import.meta.url), "utf8");
  assert.match(action, /shopPurchaseBlock/);
  assert.match(action, /highestPetLevel/);
  assert.match(action, /levelFromExperience/);
  assert.match(action, /select\("pet_type, xp"\)/);
  assert.match(action, /purchase_pet/);
  assert.doesNotMatch(action, /revalidatePath\("\/shop"\)/);
  assert.match(action, /revalidatePath\("\/inventory"\)/);
  assert.match(action, /revalidatePath\("\/dashboard"\)/);

  const dialog = readFileSync(new URL("../components/dashboard-dialogs.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  assert.match(dialog, /Every two levels unlocks the next pet/);
  assert.match(dialog, /farmerLevel < pet\.unlockLevel/);
  assert.match(dialog, /Unlocks at level \{pet\.unlockLevel\}/);
  assert.match(dialog, /"Unlock"/);
  assert.doesNotMatch(dialog, /"Buy"/);
  assert.match(dashboard, /farmerLevel=\{farmerLevel\}/);
  assert.match(dashboard, /highestPetLevel/);

  const sql = readFileSync(
    new URL("../supabase/migrations/0023_shop_level_unlock.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /function public\.purchase_pet/);
  assert.match(sql, /when 'lantern_moth' then 2/);
  assert.match(sql, /when 'river_newt' then 4/);
  assert.match(sql, /1 \+ \(greatest\(xp, 0\) \/ 100\)/);
  assert.match(sql, /Reach level % to unlock this pet/);
  assert.match(sql, /Pet already owned/);
  assert.match(sql, /Pet not for sale/);
  assert.doesNotMatch(sql, /points/);
});
