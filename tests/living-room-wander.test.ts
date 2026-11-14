import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  facingFromDirection,
  IDLE_DURATION_MS,
  normalize2d,
  PETTING_HOLD_MS,
  pickWalkDirection,
  randomIdleMs,
  randomWalkMs,
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
  const start = { left: 40, top: 50 };
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
  const start = { left: 40, top: 50 };
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

test("facing ignores mostly vertical motion", () => {
  assert.equal(facingFromDirection({ x: 0.1, y: 0.9 }, false), false);
  assert.equal(facingFromDirection({ x: -0.1, y: 0.9 }, true), true);
  assert.equal(facingFromDirection({ x: -0.9, y: 0.1 }, false), true);
  assert.equal(facingFromDirection({ x: 0.9, y: 0.1 }, true), false);
});

test("Living Room uses stroll helpers, idle legs, and no dedicated Pet button", () => {
  const source = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const idle = readFileSync(
    new URL("../public/pet-assets/pets/cat/sage/no-hat-no-clothes/idle.svg", import.meta.url),
    "utf8",
  );
  const blush = readFileSync(
    new URL("../public/pet-assets/pets/cat/sage/no-hat-no-clothes/blush.svg", import.meta.url),
    "utf8",
  );
  const walk1 = readFileSync(
    new URL("../public/pet-assets/pets/cat/sage/no-hat-no-clothes/walk1.svg", import.meta.url),
    "utf8",
  );
  assert.match(source, /stepWanderSpot/);
  assert.match(source, /randomIdleMs/);
  assert.match(source, /randomWalkMs/);
  assert.match(source, /PETTING_HOLD_MS/);
  assert.match(source, /useWalkPose\(walking/);
  assert.match(source, /walking \? walkPose : "idle"/);
  assert.match(source, /room-equipped/);
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
  assert.match(idle, /M9 34h6v4H9M27 34h6v4h-6/);
  assert.match(blush, /M9 34h6v4H9M27 34h6v4h-6/);
  assert.match(walk1, /M9 35h6v4H9M27 33h6v4h-6/);

  const renderer = readFileSync(new URL("../components/pixel-pet.tsx", import.meta.url), "utf8");
  assert.match(renderer, /if \(!active \|\| reduceMotion\) return "idle"/);
});
