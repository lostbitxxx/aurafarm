import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  bottomHalfObstacle,
  footprintObstacle,
  LOVESEAT_BLOCK_FROM,
  pxToTopPercent,
  ROOM_CARPET_SRC,
  ROOM_FLOOR_START_Y,
  ROOM_FURNITURE,
  ROOM_OBSTACLES,
  ROOM_WALK_BOUNDS,
  roomDepthZ,
  roomStartSpot,
  spotHitsObstacle,
} from "../lib/living-room-layout";
import {
  facingFromDirection,
  IDLE_DURATION_MS,
  normalize2d,
  PETTING_HOLD_MS,
  pickWalkDirection,
  randomIdleMs,
  randomWalkMs,
  resolveWanderSpot,
  stepWanderSpot,
  WALK_BOUNDS,
  WALK_DURATION_MS,
  WANDER_MAX_DT_SEC,
  WANDER_SPEED_PX,
  WANDER_VERTICAL_RATIO,
} from "../lib/living-room-wander";

test("wander timing ranges match the Living Room stroll contract", () => {
  assert.deepEqual(WALK_DURATION_MS, { min: 1500, max: 7000 });
  assert.deepEqual(IDLE_DURATION_MS, { min: 2000, max: 6000 });
  assert.equal(PETTING_HOLD_MS, 1500);
  assert.equal(WANDER_SPEED_PX, 18);
  assert.equal(WANDER_VERTICAL_RATIO, 0.68);
  assert.equal(WANDER_MAX_DT_SEC, 0.05);

  const walk = randomWalkMs(() => 0);
  const idle = randomIdleMs(() => 1);
  assert.equal(walk, WALK_DURATION_MS.min);
  assert.equal(idle, IDLE_DURATION_MS.max);
});

test("walk band stays on the floor below the wall seam", () => {
  assert.equal(WALK_BOUNDS, ROOM_WALK_BOUNDS);
  assert.ok(WALK_BOUNDS.minTop > pxToTopPercent(ROOM_FLOOR_START_Y));
  assert.ok(WALK_BOUNDS.maxTop > WALK_BOUNDS.minTop);
  assert.ok(WALK_BOUNDS.minLeft < WALK_BOUNDS.maxLeft);
});

test("direction is normalized so diagonals do not gain speed", () => {
  const unit = normalize2d(3, 4);
  assert.ok(Math.abs(Math.hypot(unit.x, unit.y) - 1) < 1e-9);
  const diag = normalize2d(1, 1);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-9);
  const walk = pickWalkDirection(() => 0.25);
  assert.ok(Math.abs(Math.hypot(walk.x, walk.y) - 1) < 1e-9);
});

test("vertical steps are slower than horizontal for the same elapsed time", () => {
  const room = { width: 400, height: 315 };
  const start = { left: 42, top: 48 };
  const right = stepWanderSpot(start, { x: 1, y: 0 }, 1, room);
  const down = stepWanderSpot(start, { x: 0, y: 1 }, 1, room);
  const dx = Math.abs(right.spot.left - start.left);
  const dy = Math.abs(down.spot.top - start.top);
  assert.ok(dx > 0 && dy > 0);
  assert.ok(dy < dx * 0.9);
  assert.ok(dy > dx * 0.5);
});

test("large elapsed steps are clamped so background tabs do not jump", () => {
  const room = { width: 400, height: 315 };
  const start = { left: 42, top: 48 };
  const capped = stepWanderSpot(start, { x: 1, y: 0 }, 5, room);
  const expected = stepWanderSpot(start, { x: 1, y: 0 }, WANDER_MAX_DT_SEC, room);
  assert.deepEqual(capped.spot, expected.spot);
});

test("hitting a bound clamps the spot and reports hitBound", () => {
  const room = { width: 400, height: 315 };
  const atEdge = { left: WALK_BOUNDS.maxLeft, top: 50 };
  const result = stepWanderSpot(atEdge, { x: 1, y: 0 }, 0.05, room);
  assert.equal(result.spot.left, WALK_BOUNDS.maxLeft);
  assert.equal(result.hitBound, true);
});

test("bottom-half furniture footprints block wander steps", () => {
  const loveseat = ROOM_FURNITURE.find((item) => item.id === "loveseat");
  assert.ok(loveseat);
  const midLeft = (loveseat.block.minLeft + loveseat.block.maxLeft) / 2;
  const midTop = (loveseat.block.minTop + loveseat.block.maxTop) / 2;
  assert.equal(spotHitsObstacle({ left: midLeft, top: midTop }), true);

  const room = { width: 400, height: 315 };
  // One capped step is ~0.2% vertically; stand just above the footprint.
  const justOutside = {
    left: midLeft,
    top: loveseat.block.minTop - 0.05,
  };
  assert.equal(spotHitsObstacle(justOutside), false);
  const intoFurniture = stepWanderSpot(justOutside, { x: 0, y: 1 }, 0.05, room);
  assert.equal(intoFurniture.moved, false);
  assert.equal(intoFurniture.hitBound, true);
  assert.deepEqual(intoFurniture.spot, justOutside);
});

test("start spots stay off furniture footprints and on the floor", () => {
  for (let i = 0; i < 8; i += 1) {
    const spot = roomStartSpot(i);
    assert.equal(spotHitsObstacle(spot), false);
    assert.ok(spot.top >= WALK_BOUNDS.minTop);
    assert.ok(spot.top <= WALK_BOUNDS.maxTop);
  }
});

test("resolveWanderSpot ejects a pet stuck inside the loveseat footprint", () => {
  const loveseat = ROOM_FURNITURE.find((item) => item.id === "loveseat");
  assert.ok(loveseat);
  const stuck = {
    left: (loveseat.block.minLeft + loveseat.block.maxLeft) / 2,
    top: (loveseat.block.minTop + loveseat.block.maxTop) / 2,
  };
  assert.equal(spotHitsObstacle(stuck), true);
  const freed = resolveWanderSpot(stuck);
  assert.equal(spotHitsObstacle(freed), false);
  assert.ok(freed.top >= WALK_BOUNDS.minTop && freed.top <= WALK_BOUNDS.maxTop);
  // Must clear the sofa column, not sit in the dead strip against the wall.
  assert.ok(freed.left > loveseat.block.maxLeft);
});

test("loveseat column has no walkable pocket against the wall", () => {
  const loveseat = ROOM_FURNITURE.find((item) => item.id === "loveseat");
  assert.ok(loveseat);
  assert.equal(loveseat.block.minTop, WALK_BOUNDS.minTop);
  assert.equal(spotHitsObstacle({ left: 14, top: WALK_BOUNDS.minTop }), true);
  assert.equal(spotHitsObstacle({ left: 34, top: 46 }), false);
});

test("loveseat no-walk zone starts higher than a plain bottom half", () => {
  const loveseat = ROOM_FURNITURE.find((item) => item.id === "loveseat");
  assert.ok(loveseat);
  assert.ok(LOVESEAT_BLOCK_FROM < 0.5);
  const raw = footprintObstacle(loveseat.bounds, LOVESEAT_BLOCK_FROM);
  const half = bottomHalfObstacle(loveseat.bounds);
  assert.ok(raw.minTop < half.minTop);
  // Sealed up to the walk-band top so pets cannot hide in the wall strip.
  assert.equal(loveseat.block.minTop, WALK_BOUNDS.minTop);
  assert.equal(loveseat.block.maxLeft, raw.maxLeft);
  assert.ok(ROOM_OBSTACLES.length === ROOM_FURNITURE.length);
  // Purple rug is floor/carpet, not a solid furniture id (former "sofa" art).
  assert.deepEqual(
    [...ROOM_FURNITURE.map((item) => item.id)].sort(),
    ["bookshelf", "lamp", "loveseat", "plant"],
  );
  assert.ok(ROOM_FURNITURE.every((item) => !item.src.includes("carpet")));
  assert.match(ROOM_CARPET_SRC, /\/base\/carpet\.svg$/);
});

test("carpet is a floor layer path and does not block wander", () => {
  assert.match(ROOM_CARPET_SRC, /\/base\/carpet\.svg$/);
  const carpet = readFileSync(new URL("../public/pet-assets/room/base/carpet.svg", import.meta.url), "utf8");
  assert.match(carpet, /viewBox="0 0 600 300"/);
  // Mid-carpet spot must stay walkable (treated like floor).
  assert.equal(spotHitsObstacle({ left: 50, top: 72 }), false);
});

test("furniture depth sorts so lower footprints draw in front", () => {
  const loveseat = ROOM_FURNITURE.find((item) => item.id === "loveseat");
  const plant = ROOM_FURNITURE.find((item) => item.id === "plant");
  assert.ok(loveseat && plant);
  assert.ok(plant.depthTop > loveseat.depthTop);
  assert.ok(roomDepthZ(plant.depthTop) > roomDepthZ(loveseat.depthTop));
});

test("facing ignores mostly vertical motion", () => {
  assert.equal(facingFromDirection({ x: 0.1, y: 0.9 }, false), false);
  assert.equal(facingFromDirection({ x: -0.1, y: 0.9 }, true), true);
  assert.equal(facingFromDirection({ x: -0.9, y: 0.1 }, false), true);
  assert.equal(facingFromDirection({ x: 0.9, y: 0.1 }, true), false);
});

test("Living Room uses layered room art, stroll helpers, and no dedicated Pet button", () => {
  const source = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../lib/living-room-layout.ts", import.meta.url), "utf8");
  const idle = readFileSync(
    new URL("../public/pet-assets/pets/cat/colors/sage/legs/stand.svg", import.meta.url),
    "utf8",
  );
  const blush = readFileSync(
    new URL("../public/pet-assets/pets/cat/colors/sage/face/blush.svg", import.meta.url),
    "utf8",
  );
  const walk1 = readFileSync(
    new URL("../public/pet-assets/pets/cat/colors/sage/legs/left-up.svg", import.meta.url),
    "utf8",
  );
  assert.match(source, /stepWanderSpot/);
  assert.match(source, /resolveWanderSpot/);
  assert.match(source, /randomIdleMs/);
  assert.match(source, /randomWalkMs/);
  assert.match(source, /PETTING_HOLD_MS/);
  assert.match(source, /useWalkPose\(walking/);
  assert.match(source, /walking \? walkPose : "idle"/);
  assert.match(source, /room-equipped/);
  assert.match(source, /ROOM_WALL_SRC/);
  assert.match(source, /ROOM_FLOOR_SRC/);
  assert.match(source, /ROOM_CARPET_SRC/);
  assert.match(source, /ROOM_FURNITURE/);
  assert.match(source, /roomDepthZ/);
  assert.doesNotMatch(source, /PettingHandIcon/);
  assert.doesNotMatch(source, /room-pet-button/);
  assert.doesNotMatch(source, /room-pet-actions/);
  assert.doesNotMatch(source, /petting-hand\.svg/);
  assert.doesNotMatch(source, />\s*Pet\s*</);
  assert.doesNotMatch(source, /setTimeout\(wander/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /onPointerCancel/);
  assert.match(source, /usePetting\(beginPetting\)/);
  assert.doesNotMatch(css, /\.room-pet-actions/);
  assert.doesNotMatch(css, /\.room-pet-button/);
  assert.doesNotMatch(css, /\.room-pet-hand/);
  assert.match(css, /\.room-equipped/);
  assert.match(css, /\.living-room-layer/);
  // [^}] already spans newlines; avoid /s (needs a newer TS target than ES2017).
  assert.match(css, /\.living-room\s*\{[^}]*isolation:\s*isolate/);
  assert.match(layout, /ROOM_FLOOR_START_Y/);
  assert.match(layout, /bottomHalfObstacle/);
  assert.match(idle, /M9 34h6v4H9M27 34h6v4h-6/);
  assert.match(blush, /M11 20h5M26 20h5/);
  assert.match(walk1, /M9 35h6v4H9M27 33h6v4h-6/);

  assert.match(css, /\.is-carpet/);
  for (const file of [
    "base/wall.svg",
    "base/floor.svg",
    "base/carpet.svg",
    "base/trim.svg",
    "furniture/loveseat.svg",
    "furniture/bookshelf.svg",
    "furniture/lamp.svg",
    "furniture/plant.svg",
  ]) {
    const svg = readFileSync(new URL(`../public/pet-assets/room/${file}`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 600 300"/);
  }

  const renderer = readFileSync(new URL("../components/pixel-pet.tsx", import.meta.url), "utf8");
  assert.match(renderer, /if \(!active \|\| reduceMotion\) return "idle"/);
});
