import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { petAssetPath, SAMPLE_COLORS, sampleColor } from "../lib/pet-assets";

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
  assert.equal(sampleColor("sage"), null);
  assert.deepEqual(
    SAMPLE_COLORS.map((color) => color.id),
    ["honey", "lavender", "rose"],
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

  assert.match(sql, /'honey', 'color', 'Honey'/);
  assert.match(sql, /'lavender', 'color', 'Lavender'/);
  assert.match(sql, /'rose', 'color', 'Rose'/);
  assert.match(backfill, /from public\.profiles/);
  assert.doesNotMatch(backfill, /user_pets/);
  assert.match(signup, /insert into public\.user_collections/);
  assert.match(signup, /'honey'\)/);
  assert.match(apply, /Color not owned/);
  assert.match(apply, /user_collections/);
  assert.match(apply, /set color = target_color/);
  assert.match(apply, /security invoker/);
});
