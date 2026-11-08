import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crossOriginIsolationHeaders } from "../lib/cross-origin-isolation";
import {
  SHOP_PRICE,
  STARTER_PET_LEVEL,
  STARTER_PET_TYPE,
  buildProfileRecord,
  buildStarterPetRecord,
  buildGodotFrameSrc,
  describePet,
  shopCatalog,
} from "../lib/pets";

test("registration inserts a profile and a desktop-active baby slime", () => {
  assert.deepEqual(buildProfileRecord("user-1", "Ada"), {
    id: "user-1",
    display_name: "Ada",
  });
  assert.deepEqual(buildStarterPetRecord("user-1"), {
    user_id: "user-1",
    pet_type: "baby_slime",
    level: 1,
    is_desktop_active: true,
  });
  assert.equal(STARTER_PET_TYPE, "baby_slime");
  assert.equal(STARTER_PET_LEVEL, 1);
  assert.equal(describePet("baby_slime").name, "Baby Slime");
});

test("the desk iframe points at the equipped pet", () => {
  assert.equal(buildGodotFrameSrc(null), "/godot-game/index.html");
  assert.equal(
    buildGodotFrameSrc({ pet_type: "baby_slime", level: 1 }),
    "/godot-game/index.html?pet=baby_slime&level=1",
  );
  assert.equal(
    buildGodotFrameSrc({ pet_type: "moss sprite", level: 2 }),
    "/godot-game/index.html?pet=moss+sprite&level=2",
  );
});

test("server headers allow SharedArrayBuffer", () => {
  const headers = Object.fromEntries(
    crossOriginIsolationHeaders.map((header) => [header.key, header.value]),
  );
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Cross-Origin-Embedder-Policy"], "require-corp");

  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /crossOriginIsolationHeaders/);
  assert.match(config, /_next\/hmr/);
});

test("the shop catalog sells every pet for the same price and skips the starter", () => {
  const catalog = shopCatalog();
  assert.deepEqual(
    catalog.map((pet) => pet.pet_type),
    ["lantern_moth", "river_newt"],
  );
  for (const pet of catalog) {
    assert.equal(pet.price, SHOP_PRICE);
    assert.equal(describePet(pet.pet_type).name, pet.name);
  }
  assert.equal(catalog.some((pet) => pet.pet_type === STARTER_PET_TYPE), false);
  assert.equal(describePet("lantern_moth").name, "Lantern Moth");
  assert.equal(describePet("river_newt").name, "River Newt");
});

test("buying a pet spends the shared price and cannot mint one", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0008_pet_shop.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /add column if not exists points integer not null default 100/);
  assert.match(sql, /check \(points >= 0\)/);
  assert.match(sql, /function public\.purchase_pet/);
  assert.match(sql, /for update/);
  assert.match(sql, /Pet already owned/);
  assert.match(sql, new RegExp(`balance < ${SHOP_PRICE}`));
  assert.match(sql, new RegExp(`points = points - ${SHOP_PRICE}`));
  assert.match(sql, /is_desktop_active\)\s*values \(auth\.uid\(\), target_pet_type, 1, false\)/);
  assert.match(sql, /user_pets_one_type_per_user/);
  assert.match(sql, /drop policy if exists "user_pets_insert_own"/);
  assert.match(sql, /revoke insert on table public\.user_pets from authenticated/);
  assert.match(sql, /grant update \(display_name, close_blocked\) on table public\.profiles/);
  assert.doesNotMatch(sql, /grant update on table public\.profiles/);
  assert.doesNotMatch(sql, /grant update \([^)]*points/);
  for (const pet of shopCatalog()) {
    assert.match(sql, new RegExp(`'${pet.pet_type}'`));
  }
  assert.doesNotMatch(sql, /'baby_slime'/);
});

test("equipping a pet is one database transaction", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0001_profiles_and_user_pets.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /function public\.equip_pet_to_desktop/);
  assert.match(sql, /set is_desktop_active = false/);
  assert.match(sql, /set is_desktop_active = true/);
  assert.match(sql, /'baby_slime', 1, true/);
});
