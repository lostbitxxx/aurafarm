import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ROOM_SKIN_PRICES,
  equipRoomSkin,
  defaultRoomDecor,
  ownedRoomSkinKeys,
  parseRoomDecor,
  roomSkinKey,
  roomSkinPrice,
  skinOwned,
} from "../lib/room-decor";

const migration = readFileSync(
  new URL("../supabase/migrations/0049_room_skin_coins.sql", import.meta.url),
  "utf8",
);

test("catalog prices match the seeded migration rows", () => {
  assert.equal(roomSkinPrice("plant", "snake"), 30);
  assert.equal(roomSkinPrice("lamp", "greenhouse"), 60);
  assert.equal(roomSkinPrice("sofa", "orbital"), 90);
  assert.equal(roomSkinPrice("wall", "leather"), 120);
  assert.equal(roomSkinPrice("floor", "base"), 0);
  assert.equal(roomSkinPrice("trim", "greenhouse"), null);
  assert.equal(Object.keys(ROOM_SKIN_PRICES).length, 21);
  for (const [key, price] of Object.entries(ROOM_SKIN_PRICES)) {
    const [category, skin] = key.split(":");
    assert.match(migration, new RegExp(`\\('${category}', '${skin}', ${price}\\)`));
  }
});

test("purchase_room_skin debits coins and grants wall trim", () => {
  assert.match(migration, /create table if not exists public\.room_skin_catalog/);
  assert.match(migration, /create table if not exists public\.user_room_skins/);
  assert.match(migration, /add column if not exists coins/);
  assert.match(migration, /function public\.purchase_room_skin/);
  assert.match(migration, /Not enough coins/);
  assert.match(migration, /Skin already owned/);
  assert.match(migration, /That skin is not for sale/);
  assert.match(migration, /coins = coins - catalog_price/);
  assert.match(migration, /target_category = 'wall'/);
  assert.match(migration, /values \(farmer, 'trim', target_skin\)/);
  assert.match(migration, /Trim skins come with the matching wall/);
});

test("grant_study_experience adds one coin per full minute", () => {
  const grant = migration.slice(migration.indexOf("create or replace function public.grant_study_experience"));
  assert.match(grant, /minutes := recorded \/ 60/);
  assert.match(grant, /set coins = coins \+ minutes/);
  assert.match(grant, /cosmetic_open := greatest\(0, catalog_count - owned_count\)/);
});

test("reset_study_world clears coins and room skins", () => {
  const reset = migration.slice(migration.indexOf("function public.reset_study_world"));
  assert.match(reset, /delete from public\.user_room_skins/);
  assert.match(reset, /coins = 0/);
});

test("owned skins can equip while unowned skins stay locked", () => {
  const decor = defaultRoomDecor();
  assert.equal(equipRoomSkin(decor, "lamp", "greenhouse"), decor);
  const owned = ownedRoomSkinKeys([{ category_id: "lamp", skin_id: "greenhouse" }]);
  assert.equal(skinOwned("lamp", "greenhouse", owned), true);
  assert.equal(skinOwned("lamp", "orbital", owned), false);
  const next = equipRoomSkin(decor, "lamp", "greenhouse", owned);
  assert.equal(next.skins.lamp, "greenhouse");
  assert.equal(skinOwned("trim", "greenhouse", ownedRoomSkinKeys([{ category_id: "wall", skin_id: "greenhouse" }])), true);
  assert.equal(roomSkinKey("wall", "greenhouse"), "wall:greenhouse");
});

test("parseRoomDecor keeps owned skins and drops the rest", () => {
  const owned = ownedRoomSkinKeys([
    { category_id: "lamp", skin_id: "orbital" },
    { category_id: "plant", skin_id: "snake" },
  ]);
  const parsed = parseRoomDecor(
    JSON.stringify({
      skins: { lamp: "orbital", floor: "leather", plant: "snake", wall: "base" },
    }),
    owned,
  );
  assert.equal(parsed.skins.lamp, "orbital");
  assert.equal(parsed.skins.plant, "snake");
  assert.equal(parsed.skins.floor, "base");
});

test("decorate dialog buys and equips with blurred locked art", () => {
  const dialog = readFileSync(new URL("../components/room-decorate-dialog.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const action = readFileSync(new URL("../lib/actions/room-decor.ts", import.meta.url), "utf8");
  assert.match(dialog, /Buy · \{detailPrice\}/);
  assert.match(dialog, /COIN_ICON_SRC/);
  assert.match(dialog, /decor-price-tag/);
  assert.match(dialog, /decor-rate/);
  assert.match(dialog, /1min = 1/);
  assert.match(dialog, /"Equip"/);
  assert.match(dialog, /blurred=\{!owned\}/);
  assert.match(dialog, /blurred=\{!detailOwned\}/);
  assert.match(dialog, /buyRoomSkin/);
  assert.match(dialog, /decor-coins/);
  assert.match(dialog, /decor-locked/);
  assert.match(dialog, /decor-owned-tag/);
  assert.doesNotMatch(dialog, /First click previews/);
  assert.match(css, /\.decor-tile\.is-locked/);
  assert.match(css, /filter:\s*blur\(5px\)/);
  assert.match(css, /\.decor-locked\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.decor-owned-tag\s*\{[^}]*border-radius:\s*999px/);
  assert.match(css, /\.decor-owned-tag\s*\{[^}]*background:\s*#c5ef47/);
  assert.match(css, /\.decor-action/);
  assert.match(css, /\.coin-icon/);
  assert.match(css, /\.decor-rate/);
  assert.match(action, /purchase_room_skin/);
  const coin = readFileSync(new URL("../public/pet-assets/ui/coin.svg", import.meta.url), "utf8");
  assert.match(coin, /shape-rendering="crispEdges"/);
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.match(header, /COIN_ICON_SRC/);
  assert.match(header, /coin-balance/);
});
