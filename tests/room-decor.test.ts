import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROOM_OBSTACLES } from "../lib/living-room-layout";
import {
  coverBox,
  decorObstacles,
  defaultRoomDecor,
  equipRoomSkin,
  isRoomItemPlaced,
  moveRoomItem,
  parseRoomDecor,
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
  assert.deepEqual(decorObstacles(defaultRoomDecor()), ROOM_OBSTACLES);
  const moved = moveRoomItem(defaultRoomDecor(), "lamp", 5, 0);
  const lamp = decorObstacles(moved).find((block) => Math.abs(block.minLeft - (ROOM_OBSTACLES[1]?.minLeft ?? 0) - 5) < 0.001);
  assert.ok(lamp);
  const removed = setRoomItemPlaced(defaultRoomDecor(), "plant", false);
  assert.equal(decorObstacles(removed).length, ROOM_OBSTACLES.length - 1);
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
  assert.match(source, /"Edit room"/);
  assert.match(source, /aria-label="Decorate"/);
  assert.match(source, /"Save"/);
  assert.match(source, /is-editing/);
  assert.match(source, /writeRoomDecor/);
  assert.match(dialog, /Decorations/);
  assert.match(dialog, /Not obtained yet/);
  assert.match(dialog, /Remove \$\{item\.label\}/);
  assert.doesNotMatch(dialog, /optional \? null/);
});
