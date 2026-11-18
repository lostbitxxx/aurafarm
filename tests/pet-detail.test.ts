import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("equip-during-session copy stays short and the pixel heart asset exists", () => {
  const assets = readFileSync(new URL("../lib/pet-assets.ts", import.meta.url), "utf8");
  const heart = readFileSync(new URL("../public/pet-assets/ui/pixel-heart.svg", import.meta.url), "utf8");
  assert.match(assets, /You cannot switch equipped pet while studying!/);
  assert.doesNotMatch(assets, /XP stays with the pet chosen when the session started/);
  assert.match(assets, /PIXEL_HEART_SRC/);
  assert.match(heart, /shape-rendering="crispEdges"/);
  assert.match(heart, /#d45d83/);
});

test("pet detail dress-up reuses collection apply actions and owned pickers", () => {
  const detail = readFileSync(new URL("../components/pet-detail-dialog.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
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
  assert.match(detail, /title=\{copy\.name\}/);
  assert.match(detail, /Lv\.\{progress\.level\}/);
  assert.match(detail, /pet-love-button/);
  assert.match(detail, /pose === "blush"/);
  assert.match(detail, /PIXEL_HEART_SRC/);
  assert.match(detail, /spawnHeart/);
  assert.doesNotMatch(detail, /Pet ♡/);
  assert.match(css, /\.tracker-card \.pet-love-button\.is-lit \{[\s\S]*?background:\s*#f3c4c8;/);
  assert.match(detail, /accessoryIconSrc\("hat", pet\.hat\)/);
  assert.match(detail, /accessoryIconSrc\("clothes", pet\.clothes\)/);
  assert.match(detail, /className="accessory-slot-art"/);
  assert.match(detail, /PixelPetArt[\s\S]*color=\{resolvedColorId\(pet\.color, pet\.pet_type\)\}/);
  assert.doesNotMatch(detail, /<b>\{colorDisplayName/);
  assert.doesNotMatch(detail, /<b>\{accessoryDisplayName/);
  assert.doesNotMatch(detail, /\{copy\.name\} · Lv\./);
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
