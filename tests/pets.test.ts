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
  wholePoints,
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

test("the shop catalog lists the sale pets and skips the starter", () => {
  assert.equal(SHOP_PRICE, 100);
  const catalog = shopCatalog();
  assert.deepEqual(
    catalog.map((pet) => pet.pet_type),
    ["lantern_moth", "river_newt"],
  );
  for (const pet of catalog) {
    assert.equal("price" in pet, false);
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
  assert.match(sql, /user_pets_one_type_per_user\s+on public\.user_pets \(user_id, pet_type\)/);
  assert.match(sql, /drop policy if exists "user_pets_insert_own"/);
  assert.doesNotMatch(sql, /create policy "user_pets_insert_own"/);
  assert.match(sql, /revoke insert on table public\.user_pets from authenticated/);
  assert.match(sql, /grant update \(display_name, close_blocked\) on table public\.profiles/);
  assert.doesNotMatch(sql, /grant update on table public\.profiles/);
  assert.doesNotMatch(sql, /grant update \([^)]*points/);
  for (const pet of shopCatalog()) {
    assert.match(sql, new RegExp(`'${pet.pet_type}'`));
  }
  assert.doesNotMatch(sql, /'baby_slime'/);
});

test("the signed-in header shows study time and public pages do not show a balance", () => {
  assert.equal(wholePoints(100), 100);
  assert.equal(wholePoints("40"), 40);
  assert.equal(wholePoints(undefined), 0);
  assert.equal(wholePoints(Number.NaN), 0);

  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const publicHeader = readFileSync(
    new URL("../components/public-header.tsx", import.meta.url),
    "utf8",
  );
  assert.match(header, /studySeconds\?: number/);
  assert.match(header, /Study/);
  assert.doesNotMatch(header, /Points/);
  assert.doesNotMatch(publicHeader, /\bpoints\b/);
  const dashboard = readFileSync(new URL("../lib/dashboard.ts", import.meta.url), "utf8");
  const score = readFileSync(new URL("../lib/study-score.ts", import.meta.url), "utf8");
  assert.match(dashboard, /display_name, study_mode, preferred_session_minutes/);
  assert.match(score, /select\("display_name"\)/);
  assert.doesNotMatch(dashboard, /study_scores/);
  assert.doesNotMatch(score, /study_scores/);

  for (const file of [
    "../components/public-header.tsx",
    "../app/page.tsx",
    "../app/login/page.tsx",
    "../app/register/page.tsx",
    "../app/privacy/page.tsx",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /points-balance|Points /, file);
  }
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
