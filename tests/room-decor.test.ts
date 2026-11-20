import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROOM_FURNITURE, ROOM_OBSTACLES, furnitureWalkObstacles } from "../lib/living-room-layout";
import {
  coverBox,
  decorObstacles,
  defaultRoomDecor,
  equipRoomSkin,
  isFurniturePlaced,
  isRoomItemPlaced,
  moveRoomItem,
  decorOptions,
  parseRoomDecor,
  ROOM_DECOR_CATEGORIES,
  roomSkinSrc,
  setRoomItemPlaced,
} from "../lib/room-decor";

test("a new room keeps must-have pieces and only the base skin", () => {
  const decor = defaultRoomDecor();
  assert.equal(isRoomItemPlaced(decor, "floor"), true);
  assert.equal(isRoomItemPlaced(decor, "board"), true);
  assert.equal(isRoomItemPlaced(decor, "music"), true);
  assert.equal(isRoomItemPlaced(decor, "trophy"), true);
  assert.equal(isRoomItemPlaced(decor, "shelf"), true);
  assert.equal(decor.skins.lamp, "base");
  assert.equal(setRoomItemPlaced(decor, "shelf", false), decor);
  assert.equal(setRoomItemPlaced(decor, "wall", false), decor);
  assert.equal(equipRoomSkin(decor, "lamp", "greenhouse"), decor);
  assert.equal(setRoomItemPlaced(decor, "lamp", false).placed.lamp, false);
  assert.equal(equipRoomSkin(setRoomItemPlaced(decor, "carpet", false), "carpet", "base").placed.carpet, true);
});

test("saved decor drops skins the player does not own", () => {
  const parsed = parseRoomDecor(
    JSON.stringify({
      skins: { lamp: "orbital", floor: "leather", plant: "snake", wall: "base" },
      placed: { carpet: false, lamp: true, shelf: false },
      offsets: { lamp: { dx: 4, dy: -2 }, bookshelf: { dx: 999, dy: 0 } },
    }),
  );
  assert.equal(parsed.skins.lamp, "base");
  assert.equal(parsed.skins.floor, "base");
  assert.equal(parsed.skins.plant, "base");
  assert.equal(parsed.skins.wall, "base");
  assert.equal(parsed.placed.carpet, false);
  assert.equal(parsed.placed.shelf, true);
  assert.equal(parsed.offsets.lamp.dx, 4);
  assert.ok(parsed.offsets.bookshelf.dx < 80);
});

test("default furniture footprints match the wander obstacles", () => {
  const decor = defaultRoomDecor();
  const placed = ROOM_FURNITURE.filter((item) => isFurniturePlaced(decor, item.id));
  assert.equal(isRoomItemPlaced(decor, "armchair"), false);
  assert.equal(isRoomItemPlaced(decor, "loveseat"), false);
  assert.equal(isRoomItemPlaced(decor, "sofa"), true);
  assert.deepEqual(decorObstacles(decor), furnitureWalkObstacles(placed));
  const moved = moveRoomItem(decor, "lamp", 5, 0);
  const lamp = decorObstacles(moved).find((block) => Math.abs(block.minLeft - (ROOM_OBSTACLES[1]?.minLeft ?? 0) - 5) < 0.001);
  assert.ok(lamp);
  const removed = setRoomItemPlaced(decor, "plant", false);
  assert.equal(decorObstacles(removed).length, furnitureWalkObstacles(placed).length - 1);
  const seats = decorOptions("sofa");
  assert.deepEqual(
    seats.map((skin) => skin.name),
    ["Armchair", "Loveseat", "Couch", "Greenhouse Couch", "Orbital Couch", "Leather Couch"],
  );
  assert.match(seats[0]?.description ?? "", /Seats 1 pet/);
  assert.match(seats[1]?.description ?? "", /Seats 2 pets/);
  assert.match(seats[2]?.description ?? "", /Seats 3 pets/);
  assert.deepEqual(
    ROOM_DECOR_CATEGORIES.filter((item) => item.sidebar !== false).map((item) => item.label),
    ["Floor", "Wall", "Carpet", "Lamp", "Shelf", "Sofa", "Plant"],
  );
});

test("equipping a wall skin keeps trim on the same theme", () => {
  const decor = defaultRoomDecor();
  const next = equipRoomSkin(decor, "wall", "base");
  assert.equal(next.skins.wall, "base");
  assert.equal(next.skins.trim, "base");
  assert.equal(ROOM_DECOR_CATEGORIES.find((item) => item.id === "trim")?.sidebar, false);
});

test("music and trophy previews crop the living-room console sheet", () => {
  assert.match(roomSkinSrc("trophy", "base"), /furniture\/storage-rack\.svg$/);
  assert.match(roomSkinSrc("music", "base"), /furniture\/storage-rack\.svg$/);
  const trophy = ROOM_DECOR_CATEGORIES.find((item) => item.id === "trophy");
  const music = ROOM_DECOR_CATEGORIES.find((item) => item.id === "music");
  assert.ok(trophy?.crop);
  assert.ok(music?.crop);
  assert.ok((trophy?.crop?.x ?? 0) > (music?.crop?.x ?? 0));
});

test("cover mapping matches the viewBox when the room is 600 by 300", () => {
  const box = coverBox({ x: 183, y: 116, width: 42, height: 60 }, 600, 300, { dx: 10, dy: 0 });
  assert.equal(box.left, 183 + 60);
  assert.equal(box.top, 116);
  assert.equal(box.width, 42);
  assert.equal(box.height, 60);
});

test("the living room can edit, decorate, and save", () => {
  const source = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../components/room-decorate-dialog.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /"Edit room"/);
  assert.match(source, /aria-label="Decorate"/);
  assert.match(source, /"Save"/);
  assert.match(source, /is-editing/);
  assert.match(source, /writeRoomDecor/);
  assert.match(dialog, /Decorations/);
  assert.match(dialog, /Not obtained yet/);
  assert.doesNotMatch(dialog, /decor-cat-toggle/);
  assert.doesNotMatch(dialog, /Remove \$\{item\.label\}/);
  assert.doesNotMatch(dialog, /optional \? null/);
  // Preview first; equip only on a second click of the same owned skin.
  assert.match(dialog, /skin\.key !== detailId/);
  assert.match(dialog, /First click previews/);
  assert.match(css, /\.decor-tile\.is-selected\s*\{[^}]*#c2342a/);
  assert.match(css, /\.decor-tile\.is-equipped\s*\{[^}]*#5aa818/);
});

test("equipping one seat clears the other seat pieces", () => {
  const decor = defaultRoomDecor();
  assert.equal(isRoomItemPlaced(decor, "sofa"), true);
  const withChair = equipRoomSkin(setRoomItemPlaced(decor, "armchair", true), "armchair", "base");
  assert.equal(isRoomItemPlaced(withChair, "armchair"), true);
  assert.equal(isRoomItemPlaced(withChair, "sofa"), false);
  assert.equal(isRoomItemPlaced(withChair, "loveseat"), false);
  const withCouch = equipRoomSkin(withChair, "sofa", "base");
  assert.equal(isRoomItemPlaced(withCouch, "sofa"), true);
  assert.equal(isRoomItemPlaced(withCouch, "armchair"), false);
});
