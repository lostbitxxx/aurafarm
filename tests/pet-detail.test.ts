import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("pet detail dress-up reuses collection apply actions and owned pickers", () => {
  const detail = readFileSync(new URL("../components/pet-detail-dialog.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const colorSql = readFileSync(
    new URL("../supabase/migrations/0018_collection_colors.sql", import.meta.url),
    "utf8",
  );
  const applyColor = colorSql.slice(colorSql.indexOf("function public.apply_pet_color"));

  assert.match(detail, /applyPetColor/);
  assert.match(detail, /applyPetHat/);
  assert.match(detail, /applyPetClothes/);
  assert.match(detail, /ownedPreviewRewards/);
  assert.match(detail, /collectionNoneCard/);
  assert.match(detail, /colorForPetType/);
  assert.match(detail, /setPicker\("color"\)/);
  assert.match(detail, /setPicker\("hat"\)/);
  assert.match(detail, /setPicker\("clothes"\)/);
  assert.match(detail, /onChoose\(null\)/);
  assert.doesNotMatch(detail, /ACCESSORY_NOTE/);
  assert.doesNotMatch(detail, /Coming soon/);
  assert.doesNotMatch(detail, /Used by/);
  assert.doesNotMatch(detail, /applyPetColor\([^,]+,\s*null/);

  assert.match(applyColor, /target_color is null/);
  assert.match(applyColor, /Color not in the collection/);

  assert.match(panel, /ownedColorIds=\{ownedColorIds\}/);
  assert.match(panel, /onColorApplied=\{onColorApplied\}/);
  assert.match(panel, /onHatApplied=\{onHatApplied\}/);
  assert.match(panel, /onClothesApplied=\{onClothesApplied\}/);

  assert.match(screen, /ownedColorIds=\{ownedColors\}/);
  assert.match(screen, /onColorApplied=\{onColorApplied\}/);
  assert.match(screen, /onClothesApplied=\{onClothesApplied\}/);
});
