import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the inventory page lists pets and the desk only names the equipped one", () => {
  const page = readFileSync(new URL("../app/inventory/page.tsx", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../lib/inventory.ts", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../lib/actions/pets.ts", import.meta.url), "utf8");
  const equip = action.slice(
    action.indexOf("export async function equipPetToDesktop"),
    action.indexOf("export async function buyPet"),
  );

  assert.match(page, /loadInventory/);
  assert.match(page, /PetInventory/);
  assert.match(loader, /getClaims/);
  assert.match(loader, /redirect\("\/login"\)/);
  assert.match(loader, /select\("id, pet_type, level, xp, is_desktop_active"\)/);
  assert.match(loader, /\.eq\("user_id", userId\)/);
  assert.match(loader, /\.order\("id", \{ ascending: true \}\)/);
  assert.doesNotMatch(loader, /createAdminClient/);
  assert.doesNotMatch(desk, /PetInventory/);
  assert.match(desk, /setDialog\("inventory"\)/);
  assert.match(desk, /describePet/);
  assert.match(equip, /equip_pet_to_desktop/);
  assert.match(equip, /revalidatePath\("\/inventory"\)/);
  assert.match(equip, /revalidatePath\("\/dashboard"\)/);
});
