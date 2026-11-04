import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crossOriginIsolationHeaders } from "../lib/cross-origin-isolation";
import {
  STARTER_PET_LEVEL,
  STARTER_PET_TYPE,
  buildProfileRecord,
  buildStarterPetRecord,
  describePet,
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
