import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ROOM_FLOOR_START_Y,
  ROOM_FURNITURE,
  ROOM_OBSTACLES,
  furnitureWalkObstacles,
  pxToTopPercent,
} from "../lib/living-room-layout";
import {
  DECOR_CENTER_SNAP_MIN_SPEED_PX_PER_MS,
  DECOR_CENTER_SNAP_RADIUS_PCT,
  DECOR_CENTER_SNAP_RELEASE_RADIUS_PCT,
  DECOR_HISTORY_LIMIT,
  clampMoverOffset,
  coverBox,
  decorHandles,
  decorObstacles,
  defaultRoomDecor,
  emptyDecorHistory,
  equipRoomSkin,
  horizontalCenterDx,
  isFurniturePlaced,
  isRoomItemPlaced,
  moveRoomItem,
  moverBounds,
  decorOptions,
  parseRoomDecor,
  pushDecorHistory,
  redoDecor,
  ROOM_DECOR_CATEGORIES,
  roomFloorPlacementTopPercent,
  roomFloorSeamTopPercent,
  roomSkinSrc,
  setRoomItemPlaced,
  undoDecor,
  withHorizontalCenterSnap,
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
  const ownedLamp = new Set(["lamp:greenhouse"]);
  assert.equal(equipRoomSkin(decor, "lamp", "greenhouse", ownedLamp).skins.lamp, "greenhouse");
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
  // Placement clamps may nudge default offsets; obstacles still track those offsets.
  assert.equal(decorObstacles(decor).length, furnitureWalkObstacles(placed).length);
  const lampBase = decorObstacles(decor).find(
    (block) => Math.abs(block.minLeft - (ROOM_OBSTACLES[1]?.minLeft ?? 0) - decor.offsets.lamp.dx) < 0.001,
  );
  assert.ok(lampBase);
  const moved = moveRoomItem(decor, "lamp", decor.offsets.lamp.dx + 5, decor.offsets.lamp.dy);
  const lamp = decorObstacles(moved).find(
    (block) => Math.abs(block.minLeft - (ROOM_OBSTACLES[1]?.minLeft ?? 0) - (decor.offsets.lamp.dx + 5)) < 0.001,
  );
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
  const movedShelter = moveRoomItem(decor, "shelter", 12, -4);
  assert.equal(movedShelter.offsets.shelter.dx, 12);
  assert.equal(movedShelter.offsets.shelter.dy, -4);
  assert.equal(decorHandles(decor).some((handle) => handle.id === "shelter" && handle.label === "Adopt"), true);
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
  assert.match(source, /"Edit Furniture"/);
  assert.match(source, /is-edit-furniture/);
  assert.match(css, /\.room-tool-button\.is-edit-furniture:is\(:hover, :focus-visible\)/);
  assert.match(source, /aria-label="Furniture Gallery"/);
  assert.doesNotMatch(source, /aria-label="Decorate"/);
  assert.match(source, /aria-label="Undo"/);
  assert.match(source, /aria-label="Redo"/);
  assert.match(source, /className="room-tool-tip"[^>]*>\s*Undo/);
  assert.match(source, /className="room-tool-tip"[^>]*>\s*Redo/);
  assert.match(source, /className="room-tool-tip"[^>]*>\s*Furniture Gallery/);
  assert.match(css, /\.room-tool-slot:hover \.room-tool-tip/);
  assert.match(css, /\.room-tool-button\.is-edit-furniture\s*\{[^}]*margin-right:\s*auto/);
  assert.match(source, /className="room-tool-group"/);
  assert.match(css, /\.room-tool-group\s*\{[^}]*margin-right:\s*auto/);
  assert.match(source, /"Save"/);
  assert.match(source, /is-editing/);
  assert.match(source, /writeRoomDecor/);
  assert.match(source, /pushDecorHistory/);
  assert.match(source, /commitDraft/);
  assert.match(source, /withHorizontalCenterSnap/);
  assert.match(dialog, /Decorations/);
  assert.match(dialog, /Buy · \{detailPrice\}/);
  assert.match(dialog, /COIN_ICON_SRC/);
  assert.match(dialog, /decor-rate/);
  assert.match(dialog, /"Equip"/);
  assert.doesNotMatch(dialog, /decor-cat-toggle/);
  assert.doesNotMatch(dialog, /Remove \$\{item\.label\}/);
  assert.doesNotMatch(dialog, /optional \? null/);
  // Select for preview; Buy / Equip buttons apply the change.
  assert.match(dialog, /Select for detail preview only/);
  assert.match(dialog, /onEquip/);
  assert.match(dialog, /onBuy/);
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

test("blackboard stays in the wall band and floor pieces keep their feet on the floor", () => {
  assert.equal(roomFloorSeamTopPercent(), pxToTopPercent(ROOM_FLOOR_START_Y));
  const board = moverBounds("blackboard");
  const boardHeight = pxToTopPercent(board.height);
  const boardTop0 = pxToTopPercent(board.y);
  const floorSeam = roomFloorSeamTopPercent();
  const floorPlacement = roomFloorPlacementTopPercent();
  assert.ok(floorPlacement > floorSeam);
  const dropped = clampMoverOffset("blackboard", board, 0, 80);
  assert.ok(boardTop0 + dropped.dy + boardHeight <= floorSeam + 0.001);

  const sofa = moverBounds("sofa");
  const sofaHeight = pxToTopPercent(sofa.height);
  const sofaTop0 = pxToTopPercent(sofa.y);
  const lifted = clampMoverOffset("sofa", sofa, 0, -80);
  assert.ok(sofaTop0 + lifted.dy + sofaHeight >= floorPlacement - 0.001);

  const decor = defaultRoomDecor();
  const movedBoard = moveRoomItem(decor, "blackboard", 0, 90);
  const boardOffsetTop = boardTop0 + movedBoard.offsets.blackboard.dy;
  assert.ok(boardOffsetTop + boardHeight <= floorSeam + 0.001);
});

test("movers stay fully inside the room frame", () => {
  const rack = moverBounds("storage-rack");
  const width = (rack.width / 600) * 100;
  const left0 = (rack.x / 600) * 100;
  const shoved = clampMoverOffset("storage-rack", rack, 200, 0);
  assert.ok(left0 + shoved.dx >= -0.001);
  assert.ok(left0 + shoved.dx + width <= 100.001);

  const leftShove = clampMoverOffset("storage-rack", rack, -200, 0);
  assert.ok(left0 + leftShove.dx >= -0.001);
});

test("horizontal center snap only engages when the pointer is fast", () => {
  const bounds = moverBounds("lamp");
  const target = horizontalCenterDx(bounds);
  const near = clampMoverOffset("lamp", bounds, target + DECOR_CENTER_SNAP_RADIUS_PCT * 0.5, 0);
  const slow = withHorizontalCenterSnap("lamp", near, DECOR_CENTER_SNAP_MIN_SPEED_PX_PER_MS * 0.2);
  assert.equal(slow.snapped, false);
  assert.equal(slow.offset.dx, near.dx);
  const fast = withHorizontalCenterSnap("lamp", near, DECOR_CENTER_SNAP_MIN_SPEED_PX_PER_MS * 2);
  assert.equal(fast.snapped, true);
  assert.equal(fast.offset.dx, clampMoverOffset("lamp", bounds, target, near.dy).dx);
  assert.equal(fast.offset.dy, near.dy);
});

test("horizontal center snap holds with hysteresis until the pointer leaves farther", () => {
  const bounds = moverBounds("lamp");
  const target = horizontalCenterDx(bounds);
  const mid = clampMoverOffset(
    "lamp",
    bounds,
    target + (DECOR_CENTER_SNAP_RADIUS_PCT + DECOR_CENTER_SNAP_RELEASE_RADIUS_PCT) / 2,
    0,
  );
  const held = withHorizontalCenterSnap("lamp", mid, 0, true);
  assert.equal(held.snapped, true);
  assert.equal(held.offset.dx, clampMoverOffset("lamp", bounds, target, mid.dy).dx);
  const far = clampMoverOffset("lamp", bounds, target + DECOR_CENTER_SNAP_RELEASE_RADIUS_PCT + 1, 0);
  const released = withHorizontalCenterSnap("lamp", far, 0, true);
  assert.equal(released.snapped, false);
  assert.equal(released.offset.dx, far.dx);
});

test("carpet stays strictly in the floor area", () => {
  const carpet = moverBounds("carpet");
  const carpetTop0 = pxToTopPercent(carpet.y);
  const floorSeam = roomFloorSeamTopPercent();
  const lifted = clampMoverOffset("carpet", carpet, 0, -100);
  assert.ok(carpetTop0 + lifted.dy >= floorSeam - 0.001);

  const decor = moveRoomItem(defaultRoomDecor(), "carpet", 0, -80);
  assert.ok(carpetTop0 + decor.offsets.carpet.dy >= floorSeam - 0.001);
});

test("decor history undo and redo keep five steps and clear redo on push", () => {
  assert.equal(DECOR_HISTORY_LIMIT, 5);
  let history = emptyDecorHistory();
  let current = defaultRoomDecor();
  const steps = [];
  for (let i = 1; i <= 6; i += 1) {
    const previous = current;
    current = moveRoomItem(current, "lamp", i, 0);
    history = pushDecorHistory(history, previous);
    steps.push(previous);
  }
  assert.equal(history.past.length, 5);
  assert.equal(history.future.length, 0);

  const undone = undoDecor(history, current);
  assert.ok(undone);
  history = undone.history;
  current = undone.decor;
  assert.equal(current.offsets.lamp.dx, steps[5]!.offsets.lamp.dx);
  assert.equal(history.future.length, 1);

  const redone = redoDecor(history, current);
  assert.ok(redone);
  history = redone.history;
  current = redone.decor;
  assert.equal(history.future.length, 0);

  const beforePush = current;
  current = moveRoomItem(current, "plant", 3, 0);
  history = pushDecorHistory(history, beforePush);
  assert.equal(history.future.length, 0);
});
