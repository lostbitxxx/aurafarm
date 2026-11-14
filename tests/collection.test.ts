import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { previewRewards } from "../lib/collection-catalog";
import { petAssetPath, SAMPLE_CLOTHES, SAMPLE_COLORS, SAMPLE_HATS, sampleClothes, sampleColor, sampleHat } from "../lib/pet-assets";

test("a saved color replaces the pet type default", () => {
  assert.equal(
    petAssetPath("baby_slime", "idle"),
    "/pet-assets/pets/cat/sage/no-hat-no-clothes/idle.svg",
  );
  assert.equal(
    petAssetPath("baby_slime", "idle", { color: "rose" }),
    "/pet-assets/pets/cat/rose/no-hat-no-clothes/idle.svg",
  );
  assert.equal(sampleColor("rose"), "rose");
  assert.equal(sampleColor("sage"), "sage");
  assert.equal(sampleColor("ink"), null);
  assert.deepEqual(
    SAMPLE_COLORS.map((color) => color.id),
    ["honey", "apricot", "rose", "coral", "lavender", "sage", "mint", "sky", "lemon", "slate", "white", "black"],
  );
});

test("sample colors are owned once per account and refused when missing", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0018_collection_colors.sql", import.meta.url),
    "utf8",
  );
  const backfill = sql.slice(
    sql.indexOf("insert into public.user_collections"),
    sql.indexOf("alter table public.collection_items enable row level security"),
  );
  const signup = sql.slice(sql.indexOf("function public.handle_new_user"), sql.indexOf("function public.apply_pet_color"));
  const apply = sql.slice(sql.indexOf("function public.apply_pet_color"));

  for (const [id, name] of [
    ["honey", "Honey"],
    ["apricot", "Apricot"],
    ["rose", "Rose"],
    ["coral", "Coral"],
    ["lavender", "Lavender"],
    ["sage", "Sage"],
    ["mint", "Mint"],
    ["sky", "Sky"],
    ["lemon", "Lemon"],
    ["slate", "Slate"],
    ["white", "White"],
    ["black", "Black"],
  ]) {
    assert.match(sql, new RegExp(`'${id}', 'color', '${name}'`));
  }
  assert.match(backfill, /from public\.profiles/);
  assert.doesNotMatch(backfill, /user_pets/);
  assert.match(signup, /insert into public\.user_collections/);
  assert.match(signup, /'honey'\)/);
  assert.match(apply, /Color not owned/);
  assert.match(apply, /user_collections/);
  assert.match(apply, /set color = target_color/);
  assert.match(apply, /security invoker/);
});

test("a saved hat uses its folder and an empty hat does not", () => {
  assert.equal(
    petAssetPath("baby_slime", "idle", { hat: "hat_a" }),
    "/pet-assets/pets/cat/sage/hat_a-no-clothes/idle.svg",
  );
  assert.equal(
    petAssetPath("baby_slime", "idle", { hat: null }),
    "/pet-assets/pets/cat/sage/no-hat-no-clothes/idle.svg",
  );
  assert.equal(sampleHat("hat_a"), "hat_a");
  assert.equal(sampleHat("forest"), null);
  assert.deepEqual(
    SAMPLE_HATS.map((hat) => hat.id),
    ["hat_a", "hat_b", "hat_c", "hat_d", "hat_e", "hat_f", "hat_g", "hat_h", "hat_i", "hat_j"],
  );
});

test("hat ids are owned once per account and pets stay without a hat", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0019_collection_hats.sql", import.meta.url),
    "utf8",
  );
  const backfill = sql.slice(
    sql.indexOf("insert into public.user_collections"),
    sql.indexOf("create or replace function public.handle_new_user"),
  );
  const signup = sql.slice(
    sql.indexOf("function public.handle_new_user"),
    sql.indexOf("function public.apply_pet_hat"),
  );
  const apply = sql.slice(sql.indexOf("function public.apply_pet_hat"));

  for (const id of ["hat_a", "hat_b", "hat_c", "hat_d", "hat_e", "hat_f", "hat_g", "hat_h", "hat_i", "hat_j"]) {
    assert.match(sql, new RegExp(`'${id}', 'hat', '${id}'`));
  }
  assert.match(sql, /hat_c through hat_j are already in the database/);
  assert.match(backfill, /from public\.profiles/);
  assert.doesNotMatch(backfill, /user_pets/);
  assert.doesNotMatch(signup, /set hat/);
  assert.match(signup, /'hat_a'/);
  assert.match(apply, /Hat not owned/);
  assert.match(apply, /set hat = target_hat/);
  assert.match(apply, /security invoker/);
});

test("a saved outfit uses its folder and empty clothes do not", () => {
  assert.equal(
    petAssetPath("baby_slime", "idle", { clothes: "clothes_a" }),
    "/pet-assets/pets/cat/sage/no-hat-clothes_a/idle.svg",
  );
  assert.equal(
    petAssetPath("baby_slime", "idle", { hat: "hat_a", clothes: "clothes_a" }),
    "/pet-assets/pets/cat/sage/hat_a-clothes_a/idle.svg",
  );
  assert.equal(
    petAssetPath("baby_slime", "idle", { clothes: null }),
    "/pet-assets/pets/cat/sage/no-hat-no-clothes/idle.svg",
  );
  assert.equal(sampleClothes("clothes_a"), "clothes_a");
  assert.equal(sampleClothes("blue-vest"), null);
  assert.deepEqual(
    SAMPLE_CLOTHES.map((clothes) => clothes.id),
    ["clothes_a", "clothes_b", "clothes_c", "clothes_d", "clothes_e", "clothes_f", "clothes_g", "clothes_h", "clothes_i", "clothes_j"],
  );
});

test("clothes ids are owned once per account and pets stay without clothes", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0020_collection_clothes.sql", import.meta.url),
    "utf8",
  );
  const backfill = sql.slice(
    sql.indexOf("insert into public.user_collections"),
    sql.indexOf("create or replace function public.handle_new_user"),
  );
  const signup = sql.slice(
    sql.indexOf("function public.handle_new_user"),
    sql.indexOf("function public.apply_pet_clothes"),
  );
  const apply = sql.slice(sql.indexOf("function public.apply_pet_clothes"));

  for (const id of ["clothes_a", "clothes_b", "clothes_c", "clothes_d", "clothes_e", "clothes_f", "clothes_g", "clothes_h", "clothes_i", "clothes_j"]) {
    assert.match(sql, new RegExp(`'${id}', 'clothes', '${id}'`));
  }
  assert.match(sql, /clothes_c through clothes_j are already in the database/);
  assert.match(backfill, /from public\.profiles/);
  assert.doesNotMatch(backfill, /user_pets/);
  assert.doesNotMatch(signup, /set clothes/);
  assert.match(signup, /'clothes_a'/);
  assert.match(signup, /'hat_a'/);
  assert.match(apply, /Clothes not owned/);
  assert.match(apply, /set clothes = target_clothes/);
  assert.match(apply, /security invoker/);
});

test("a new pet level banks one unspent collection choice", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0024_collection_level_rewards.sql", import.meta.url),
    "utf8",
  );
  const grant = sql.slice(
    sql.indexOf("function public.grant_study_experience"),
    sql.indexOf("function public.claim_collection_reward"),
  );
  const claim = sql.slice(
    sql.indexOf("function public.claim_collection_reward"),
    sql.indexOf("function public.handle_new_user"),
  );
  const signup = sql.slice(
    sql.indexOf("function public.handle_new_user"),
    sql.indexOf("function public.reset_study_world"),
  );
  const reset = sql.slice(sql.indexOf("function public.reset_study_world"));

  assert.match(sql, /unique \(user_id, pet_id, level_reached\)/);
  assert.match(sql, /level_reached >= 2/);
  assert.match(sql, /item_id is null/);
  assert.match(grant, /select xp into previous_xp/);
  assert.match(grant, /level = 1 \+ \(\(user_pets\.xp \+ gained\) \/ 100\)/);
  assert.match(grant, /insert into public\.collection_rewards/);
  assert.match(grant, /on conflict \(user_id, pet_id, level_reached\) do nothing/);
  assert.match(grant, /gained := minutes \* xp_per_minute/);
  assert.match(grant, /if apply_finish_bonus then/);
  assert.match(grant, /security definer/);
  assert.match(claim, /Item not in the collection/);
  assert.match(claim, /Item already owned/);
  assert.match(claim, /No reward to claim/);
  assert.match(claim, /insert into public\.user_collections/);
  assert.match(claim, /set item_id = target_item/);
  assert.match(claim, /for update/);
  assert.match(claim, /security definer/);
  assert.match(signup, /'baby_slime'/);
  assert.doesNotMatch(signup, /user_collections/);
  assert.doesNotMatch(signup, /collection_rewards/);
  assert.match(reset, /delete from public\.collection_rewards/);
  assert.match(reset, /delete from public\.user_collections/);
  assert.match(reset, /color = null/);
  assert.match(reset, /hat = null/);
  assert.match(reset, /clothes = null/);
  assert.match(reset, /level = 1/);
});

test("approved hats and clothes can be chosen as a level reward", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0025_collection_accessory_rewards.sql", import.meta.url),
    "utf8",
  );
  const picker = readFileSync(new URL("../components/level-up-reward.tsx", import.meta.url), "utf8");
  for (const item of [...previewRewards("hat"), ...previewRewards("clothes")]) {
    assert.ok(item.name.length <= 32);
    assert.match(sql, new RegExp(`'${item.id}', '${item.kind}', '${item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
  }
  assert.match(picker, /previewRewards\("hat"\)/);
  assert.match(picker, /previewRewards\("clothes"\)/);
  assert.match(picker, /collection-accessory-art/);
});

test("an owned approved hat or outfit can be applied to a pet", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0026_apply_accessory_rewards.sql", import.meta.url),
    "utf8",
  );
  const actions = readFileSync(new URL("../lib/actions/pets.ts", import.meta.url), "utf8");
  const hatCheck = sql.slice(sql.indexOf("user_pets_hat_check"), sql.indexOf("user_pets_clothes_check"));
  const clothesCheck = sql.slice(sql.indexOf("user_pets_clothes_check"), sql.indexOf("function public.apply_pet_hat"));
  const applyHat = sql.slice(sql.indexOf("function public.apply_pet_hat"), sql.indexOf("function public.apply_pet_clothes"));
  const applyClothes = sql.slice(sql.indexOf("function public.apply_pet_clothes"));
  for (const item of previewRewards("hat")) {
    assert.match(hatCheck, new RegExp(`'${item.id}'`));
  }
  for (const item of previewRewards("clothes")) {
    assert.match(clothesCheck, new RegExp(`'${item.id}'`));
  }
  assert.match(applyHat, /kind = 'hat'/);
  assert.match(applyHat, /Hat not owned/);
  assert.match(applyHat, /set hat = target_hat/);
  assert.match(applyClothes, /kind = 'clothes'/);
  assert.match(applyClothes, /Clothes not owned/);
  assert.match(applyClothes, /set clothes = target_clothes/);
  assert.match(actions, /previewReward\(hatId\)\?\.kind !== "hat"/);
  assert.match(actions, /previewReward\(clothesId\)\?\.kind !== "clothes"/);
});

test("choosing a level reward wears it on the pet that earned the level", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0035_claim_applies_reward.sql", import.meta.url),
    "utf8",
  );
  const claim = sql.slice(sql.indexOf("function public.claim_collection_reward"));
  const screen = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const claimed = screen.slice(screen.indexOf("function onRewardClaimed"), screen.indexOf("const celebrationPet"));
  const picker = readFileSync(new URL("../components/level-up-reward.tsx", import.meta.url), "utf8");

  assert.match(claim, /select kind into item_kind/);
  assert.match(claim, /from public\.collection_items/);
  assert.match(claim, /select id, pet_id into reward_id, reward_pet_id/);
  assert.match(claim, /Item not in the collection/);
  assert.match(claim, /Item already owned/);
  assert.match(claim, /No reward to claim/);
  assert.match(claim, /insert into public\.user_collections/);
  assert.match(claim, /set item_id = target_item/);
  assert.match(claim, /for update/);
  assert.match(claim, /security definer/);
  assert.match(claim, /item_kind = 'color'/);
  assert.match(claim, /set color = target_item/);
  assert.match(claim, /item_kind = 'hat'/);
  assert.match(claim, /set hat = target_item/);
  assert.match(claim, /item_kind = 'clothes'/);
  assert.match(claim, /set clothes = target_item/);
  assert.match(claim, /where id = reward_pet_id/);
  assert.match(claim, /and user_id = auth\.uid\(\)/);
  assert.match(claimed, /rewards\[0\]\?\.petId/);
  assert.match(claimed, /setLocalPets/);
  assert.match(claimed, /return \{ \.\.\.pet, color \}/);
  assert.match(claimed, /return \{ \.\.\.pet, hat \}/);
  assert.match(claimed, /return \{ \.\.\.pet, clothes \}/);
  assert.match(picker, /worn by this pet/);
});
