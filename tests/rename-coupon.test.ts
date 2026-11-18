import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { petDisplayName } from "../lib/pets";
import {
  clampRenameCoupons,
  normalizePetName,
  petNameError,
  RENAME_COUPON_ID,
  RENAME_COUPON_MAX,
  RENAME_COUPON_NAME,
  RENAME_PET_NAME_MAX,
} from "../lib/rename-coupon";

test("petDisplayName prefers a custom name over the species label", () => {
  assert.equal(petDisplayName({ pet_type: "baby_slime", name: null }), "Matcha");
  assert.equal(petDisplayName({ pet_type: "baby_slime", name: "  Fluffy  " }), "Fluffy");
  assert.equal(petDisplayName({ pet_type: "lantern_moth" }), "Taro");
});

test("rename coupon helpers clamp counts and validate names", () => {
  assert.equal(RENAME_COUPON_ID, "rename_coupon");
  assert.equal(RENAME_COUPON_MAX, 3);
  assert.equal(RENAME_COUPON_NAME, "Rename coupon");
  assert.equal(clampRenameCoupons(9), 3);
  assert.equal(clampRenameCoupons(-2), 0);
  assert.equal(clampRenameCoupons("2"), 2);
  assert.equal(normalizePetName("  Ada  "), "Ada");
  assert.equal(petNameError(""), `Pick a name between 1 and ${RENAME_PET_NAME_MAX} characters.`);
  assert.equal(petNameError("a".repeat(RENAME_PET_NAME_MAX + 1)), `Pick a name between 1 and ${RENAME_PET_NAME_MAX} characters.`);
  assert.equal(petNameError("Coffee"), "");
});

test("migration 0047 banks rename coupons, renames pets, and stores show_pet_names", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0047_rename_coupons.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /add column if not exists rename_coupons/);
  assert.match(sql, /rename_coupons between 0 and 3/);
  assert.match(sql, /add column if not exists show_pet_names boolean not null default true/);
  assert.match(sql, /add column if not exists name text/);
  assert.match(sql, /char_length\(btrim\(name\)\) between 1 and 16/);
  assert.match(sql, /'rename_coupon'/);
  assert.match(sql, /kind in \('color', 'hat', 'clothes', 'rename_coupon'\)/);

  const claim = sql.slice(sql.indexOf("function public.claim_collection_reward"));
  assert.match(claim, /item_kind = 'rename_coupon'/);
  assert.match(claim, /Maximum coupon reached/);
  assert.match(claim, /rename_coupons = rename_coupons \+ 1/);
  assert.doesNotMatch(
    claim.slice(claim.indexOf("item_kind = 'rename_coupon'"), claim.indexOf("if exists")),
    /insert into public\.user_collections/,
  );

  assert.match(sql, /function public\.rename_pet/);
  assert.match(sql, /No rename coupon/);
  assert.match(sql, /rename_coupons = rename_coupons - 1/);
  assert.match(sql, /function public\.update_show_pet_names/);

  const grant = sql.slice(sql.indexOf("function public.grant_study_experience"));
  assert.match(grant, /cosmetic_open := greatest\(0, catalog_count - owned_count\)/);
  assert.match(grant, /coupon_open := greatest\(0, 3 - coalesce\(coupon_count, 0\)\)/);
  assert.match(grant, /open_slots := greatest\(0, cosmetic_open \+ coupon_open - pending_count\)/);
  assert.match(grant, /kind in \('color', 'hat', 'clothes'\)/);

  assert.match(sql, /rename_coupons = 0/);
  assert.match(sql, /name = null/);
});

test("reward picker always offers a rename coupon and greys it out at max", () => {
  const picker = readFileSync(new URL("../components/level-up-reward.tsx", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../lib/actions/pets.ts", import.meta.url), "utf8");

  assert.match(picker, /Pick one color, hat, outfit, or rename coupon/);
  assert.match(picker, /RenameCouponChoiceButton/);
  assert.match(picker, /Maximum coupon reached/);
  assert.match(picker, /renameCoupons >= RENAME_COUPON_MAX/);
  assert.match(picker, /RENAME_COUPON_ID/);
  assert.match(screen, /renameCoupons=\{renameCoupons\}/);
  assert.match(screen, /itemId === RENAME_COUPON_ID/);
  assert.match(actions, /itemId !== RENAME_COUPON_ID/);
  assert.match(actions, /Maximum coupon reached/);
});

test("pet detail spends a rename coupon and settings default to showing names", () => {
  const detail = readFileSync(new URL("../components/pet-detail-dialog.tsx", import.meta.url), "utf8");
  const renameUi = readFileSync(new URL("../components/pet-rename-controls.tsx", import.meta.url), "utf8");
  const inventory = readFileSync(new URL("../components/dashboard-dialogs.tsx", import.meta.url), "utf8");
  const icon = readFileSync(new URL("../lib/rename-coupon.ts", import.meta.url), "utf8");
  const room = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../components/social-settings-dialog.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../lib/dashboard.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../lib/actions/pets.ts", import.meta.url), "utf8");

  assert.match(detail, /PetRenameForm/);
  assert.match(detail, /PetRenameCircleButton/);
  assert.match(detail, /Rename coupons:/);
  assert.match(detail, /pet-detail-dialog-title/);
  assert.doesNotMatch(detail, /pet-detail-display-name/);
  assert.match(renameUi, /renamePet/);
  assert.match(renameUi, /aria-label="Rename"/);
  assert.match(renameUi, /Confirm rename, spend one coupon/);
  assert.match(renameUi, /RENAME_COUPON_ICON/);
  assert.match(renameUi, />-1</);
  assert.match(icon, /rename-coupon\.png/);
  assert.match(inventory, /PetRenameCircleButton/);
  assert.match(inventory, /inventory-pet-name/);
  assert.match(inventory, /Level \{pet\.level\}/);
  assert.match(room, /showPetNames \? displayName : `Lv\.\$\{progress\.level\}`/);
  assert.match(settings, /Show pet names/);
  assert.match(settings, /updateShowPetNames/);
  assert.match(settings, /aria-checked=\{namesVisible\}/);
  assert.match(dashboard, /show_pet_names/);
  assert.match(dashboard, /showPetNames/);
  assert.match(dashboard, /renameCoupons/);
  assert.match(actions, /function renamePet/);
  assert.match(actions, /function updateShowPetNames/);
  assert.match(dashboard, /show_pet_names !== false/);
});
