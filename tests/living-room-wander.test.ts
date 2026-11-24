import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  bottomHalfObstacle,
  FURNITURE_BLOCK_FROM,
  footprintObstacle,
  PET_STANDING_FROM_CENTER_PCT,
  petStandingTop,
  pxToLeftPercent,
  pxToTopPercent,
  ROOM_CARPET_SRC,
  ROOM_FLOOR_START_Y,
  BOOKSHELF_DEPTH_TOP,
  depthTopFromBounds,
  ROOM_DEPTH_Z_MAX,
  ROOM_DRAG_Z,
  ROOM_FURNITURE,
  ROOM_LABEL_Z,
  ROOM_OBSTACLES,
  ROOM_RACK_HOTSPOTS,
  ROOM_WALK_BOUNDS,
  STORAGE_RACK_DEPTH_TOP,
  roomDepthZ,
  roomStartSpot,
  standingHitsObstacle,
  wrapCenterFromStanding,
} from "../lib/living-room-layout";
import {
  DRAG_START_PX,
  DRAG_STRUGGLE_AFTER_MS,
  DRAG_STRUGGLE_DEG,
  dragPastThreshold,
  facingFromDirection,
  FOREHEAD_OFFSET_Y_RATIO,
  IDLE_DURATION_MS,
  normalize2d,
  PETTING_HOLD_MS,
  pickWalkDirection,
  pointerPercentInRoom,
  clearSessionWanderSpots,
  randomIdleMs,
  randomWalkMs,
  randomWanderSpot,
  resolveWanderSpot,
  sessionOrRandomWanderSpot,
  spotFromForeheadPointer,
  stepWanderSpot,
  writeSessionWanderSpot,
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
  assert.equal(WANDER_SPEED_PX, 36);
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
  const start = { left: 44, top: 64 };
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
  const start = { left: 44, top: 64 };
  const capped = stepWanderSpot(start, { x: 1, y: 0 }, 5, room);
  const expected = stepWanderSpot(start, { x: 1, y: 0 }, WANDER_MAX_DT_SEC, room);
  assert.deepEqual(capped.spot, expected.spot);
});

test("hitting a bound clamps the spot and reports hitBound", () => {
  const room = { width: 400, height: 315 };
  const atEdge = { left: WALK_BOUNDS.maxLeft, top: 64 };
  const result = stepWanderSpot(atEdge, { x: 1, y: 0 }, 0.05, room);
  assert.equal(result.spot.left, WALK_BOUNDS.maxLeft);
  assert.equal(result.hitBound, true);
});

test("standing line blocks on furniture lower-half bases", () => {
  const sofa = ROOM_FURNITURE.find((item) => item.id === "sofa");
  assert.ok(sofa);
  assert.deepEqual(sofa.block, bottomHalfObstacle(sofa.bounds));
  const midLeft = (sofa.block.minLeft + sofa.block.maxLeft) / 2;
  const feetInBlock = {
    left: midLeft,
    top: wrapCenterFromStanding((sofa.block.minTop + sofa.block.maxTop) / 2),
  };
  assert.equal(standingHitsObstacle(feetInBlock), true);

  const room = { width: 400, height: 315 };
  const justOutside = {
    left: midLeft,
    top: wrapCenterFromStanding(sofa.block.minTop - 0.05),
  };
  assert.equal(standingHitsObstacle(justOutside), false);
  const intoFurniture = stepWanderSpot(justOutside, { x: 0, y: 1 }, 0.05, room);
  assert.equal(intoFurniture.moved, false);
  assert.equal(intoFurniture.hitBound, true);
  assert.deepEqual(intoFurniture.spot, justOutside);
});

test("start spots keep standing lines off furniture and on the floor", () => {
  for (let i = 0; i < 8; i += 1) {
    const spot = roomStartSpot(i);
    assert.equal(standingHitsObstacle(spot), false);
    const standing = petStandingTop(spot.top, "floor");
    assert.ok(standing >= WALK_BOUNDS.minTop);
    assert.ok(standing <= WALK_BOUNDS.maxTop);
  }
});

test("resolveWanderSpot ejects a pet whose standing line is in the sofa base", () => {
  const sofa = ROOM_FURNITURE.find((item) => item.id === "sofa");
  assert.ok(sofa);
  const stuck = {
    left: (sofa.block.minLeft + sofa.block.maxLeft) / 2,
    top: wrapCenterFromStanding((sofa.block.minTop + sofa.block.maxTop) / 2),
  };
  assert.equal(standingHitsObstacle(stuck), true);
  const freed = resolveWanderSpot(stuck);
  assert.equal(standingHitsObstacle(freed), false);
  assert.ok(petStandingTop(freed.top, "floor") >= WALK_BOUNDS.minTop);
  assert.ok(petStandingTop(freed.top, "floor") <= WALK_BOUNDS.maxTop);
  assert.ok(freed.left > sofa.block.maxLeft);
});

test("furniture no-walk zones are the lower half of each piece", () => {
  assert.equal(FURNITURE_BLOCK_FROM, 0.5);
  for (const item of ROOM_FURNITURE) {
    if (item.id === "blackboard") continue;
    assert.deepEqual(item.block, footprintObstacle(item.bounds, FURNITURE_BLOCK_FROM), item.id);
  }
  assert.ok(ROOM_OBSTACLES.length === ROOM_FURNITURE.filter((item) => item.id !== "blackboard").length);
  assert.deepEqual(
    [...ROOM_FURNITURE.map((item) => item.id)].sort(),
    ["armchair", "blackboard", "bookshelf", "lamp", "loveseat", "plant", "sofa", "storage-rack"],
  );
  assert.ok(ROOM_FURNITURE.every((item) => !item.src.includes("carpet")));
  assert.match(ROOM_CARPET_SRC, /\/carpet\/base\.svg$/);
});

test("carpet is a floor layer path and does not block wander", () => {
  assert.match(ROOM_CARPET_SRC, /\/carpet\/base\.svg$/);
  const carpet = readFileSync(new URL("../public/pet-assets/room/carpet/base.svg", import.meta.url), "utf8");
  assert.match(carpet, /viewBox="0 0 600 300"/);
  assert.equal(standingHitsObstacle({ left: 50, top: 72 }), false);
});

test("furniture depth sorts so lower footprints draw in front", () => {
  const loveseat = ROOM_FURNITURE.find((item) => item.id === "sofa");
  const plant = ROOM_FURNITURE.find((item) => item.id === "plant");
  assert.ok(loveseat && plant);
  assert.ok(plant.depthTop > loveseat.depthTop);
  assert.ok(roomDepthZ(plant.depthTop) > roomDepthZ(loveseat.depthTop));
});

test("shelf and rack use bbox-bottom depth with lower-half collision", () => {
  const shelf = ROOM_FURNITURE.find((item) => item.id === "bookshelf");
  const rack = ROOM_FURNITURE.find((item) => item.id === "storage-rack");
  const board = ROOM_FURNITURE.find((item) => item.id === "blackboard");
  assert.ok(shelf && rack && board);
  assert.equal(shelf.depthTop, BOOKSHELF_DEPTH_TOP);
  assert.equal(shelf.depthTop, depthTopFromBounds(shelf.bounds));
  assert.deepEqual(shelf.block, footprintObstacle(shelf.bounds, FURNITURE_BLOCK_FROM));
  assert.equal(rack.depthTop, STORAGE_RACK_DEPTH_TOP);
  assert.equal(rack.depthTop, depthTopFromBounds(rack.bounds));
  assert.deepEqual(rack.block, footprintObstacle(rack.bounds, FURNITURE_BLOCK_FROM));
  // Blackboard stays behind every floor piece and typical standing lines.
  assert.equal(board.depthTop, 0);
  assert.ok(roomDepthZ(board.depthTop) < roomDepthZ(shelf.depthTop));
  assert.ok(roomDepthZ(petStandingTop(ROOM_WALK_BOUNDS.minTop, "feet")) > roomDepthZ(board.depthTop));
});

test("storage rack sits between sofa and shelf with drawer hotspots", () => {
  const rack = ROOM_FURNITURE.find((item) => item.id === "storage-rack");
  const loveseat = ROOM_FURNITURE.find((item) => item.id === "sofa");
  const shelf = ROOM_FURNITURE.find((item) => item.id === "bookshelf");
  assert.ok(rack && loveseat && shelf);
  assert.equal(rack.depthTop, STORAGE_RACK_DEPTH_TOP);
  assert.ok(rack.bounds.x > loveseat.bounds.x + loveseat.bounds.width);
  assert.ok(rack.bounds.x + rack.bounds.width < shelf.bounds.x);
  assert.deepEqual(
    ROOM_RACK_HOTSPOTS.map((spot) => spot.id),
    ["song", "achievements", "collection"],
  );
  for (const spot of ROOM_RACK_HOTSPOTS) {
    assert.ok(spot.bounds.x >= rack.bounds.x);
    assert.ok(spot.bounds.x + spot.bounds.width <= rack.bounds.x + rack.bounds.width);
    assert.ok(spot.box.minLeft >= pxToLeftPercent(rack.bounds.x) - 0.01);
    assert.ok(spot.box.maxLeft <= pxToLeftPercent(rack.bounds.x + rack.bounds.width) + 0.01);
  }
});

test("standing line sits below wrap center by the painted feet offset", () => {
  assert.ok(PET_STANDING_FROM_CENTER_PCT > 5 && PET_STANDING_FROM_CENTER_PCT < 8);
  assert.equal(petStandingTop(50, "feet"), 50);
  assert.equal(petStandingTop(50, "floor"), 50 + PET_STANDING_FROM_CENTER_PCT);
  const plant = ROOM_FURNITURE.find((item) => item.id === "plant");
  assert.ok(plant);
  // Center above the pot bottom, feet at/below it → pet paints in front.
  const centerAbovePot = plant.depthTop - 2;
  assert.ok(roomDepthZ(centerAbovePot) < roomDepthZ(plant.depthTop));
  assert.ok(roomDepthZ(petStandingTop(centerAbovePot, "floor")) > roomDepthZ(plant.depthTop));
});

test("drag z-index sits above every depth-sorted room layer", () => {
  assert.equal(ROOM_DEPTH_Z_MAX, 200);
  assert.ok(ROOM_DRAG_Z > ROOM_DEPTH_Z_MAX);
  assert.ok(ROOM_DRAG_Z > roomDepthZ(100));
  assert.ok(ROOM_LABEL_Z > ROOM_DEPTH_Z_MAX);
  assert.ok(ROOM_LABEL_Z > ROOM_DRAG_Z);
  for (const item of ROOM_FURNITURE) {
    assert.ok(ROOM_DRAG_Z > roomDepthZ(item.depthTop), item.id);
    assert.ok(ROOM_LABEL_Z > roomDepthZ(item.depthTop), item.id);
  }
});

test("facing ignores mostly vertical motion", () => {
  assert.equal(facingFromDirection({ x: 0.1, y: 0.9 }, false), false);
  assert.equal(facingFromDirection({ x: -0.1, y: 0.9 }, true), true);
  assert.equal(facingFromDirection({ x: -0.9, y: 0.1 }, false), true);
  assert.equal(facingFromDirection({ x: 0.9, y: 0.1 }, true), false);
});

test("randomWanderSpot stays on the walkable floor", () => {
  let seq = 0;
  const rand = () => {
    seq += 1;
    return (seq % 10) / 10;
  };
  for (let i = 0; i < 20; i += 1) {
    const spot = randomWanderSpot(rand);
    assert.equal(standingHitsObstacle(spot), false);
    assert.ok(spot.left >= WALK_BOUNDS.minLeft && spot.left <= WALK_BOUNDS.maxLeft);
    const standing = petStandingTop(spot.top, "floor");
    assert.ok(standing >= WALK_BOUNDS.minTop && standing <= WALK_BOUNDS.maxTop);
  }
});

test("session wander spots are in-memory only and reused until cleared", () => {
  clearSessionWanderSpots();
  const first = sessionOrRandomWanderSpot("pet-session-a", () => 0.25);
  const again = sessionOrRandomWanderSpot("pet-session-a", () => 0.9);
  assert.deepEqual(again, first);
  writeSessionWanderSpot("pet-session-a", { left: 55, top: 50 });
  const placed = sessionOrRandomWanderSpot("pet-session-a", () => 0.1);
  assert.equal(placed.left, 55);
  assert.equal(placed.top, 50);
  clearSessionWanderSpots();
  const afterClear = sessionOrRandomWanderSpot("pet-session-a", () => 0.25);
  assert.deepEqual(afterClear, first);
});

test("drag helpers use forehead offset and a movement threshold", () => {
  assert.equal(DRAG_START_PX, 8);
  assert.equal(DRAG_STRUGGLE_AFTER_MS, 1500);
  assert.equal(DRAG_STRUGGLE_DEG, 10);
  assert.equal(FOREHEAD_OFFSET_Y_RATIO, 0.12);

  assert.equal(dragPastThreshold(0, 0, 3, 4), false);
  assert.equal(dragPastThreshold(0, 0, 6, 8), true);

  const pct = pointerPercentInRoom(120, 80, { left: 100, top: 50, width: 200, height: 100 });
  assert.equal(pct.left, 10);
  assert.equal(pct.top, 30);

  const room = { width: 400, height: 200 };
  const wrapHeight = 86;
  const grabbed = spotFromForeheadPointer(40, 50, room, wrapHeight);
  assert.equal(grabbed.left, 40);
  // Body center sits below the forehead so the cursor holds the hat/forehead band.
  assert.ok(grabbed.top > 50);
  const expectedOffset = ((FOREHEAD_OFFSET_Y_RATIO * wrapHeight) / room.height) * 100;
  assert.ok(Math.abs(grabbed.top - (50 + expectedOffset)) < 1e-9);
});

test("dropping on furniture resolves to a walkable spot", () => {
  const sofa = ROOM_FURNITURE.find((item) => item.id === "sofa");
  assert.ok(sofa);
  const ontoSofa = {
    left: (sofa.block.minLeft + sofa.block.maxLeft) / 2,
    top: wrapCenterFromStanding((sofa.block.minTop + sofa.block.maxTop) / 2),
  };
  assert.equal(standingHitsObstacle(ontoSofa), true);
  const placed = resolveWanderSpot(ontoSofa);
  assert.equal(standingHitsObstacle(placed), false);
  const standing = petStandingTop(placed.top, "floor");
  assert.ok(standing >= WALK_BOUNDS.minTop && standing <= WALK_BOUNDS.maxTop);
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
  const struggle = readFileSync(
    new URL("../public/pet-assets/pets/cat/colors/sage/face/struggle.svg", import.meta.url),
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
  assert.match(source, /struggling \? "struggle" : walking \? walkPose : "idle"/);
  assert.match(source, /room-equipped/);
  assert.match(source, /ROOM_WALL_SRC/);
  assert.match(source, /ROOM_FLOOR_SRC/);
  assert.match(source, /ROOM_CARPET_SRC/);
  assert.match(source, /ROOM_FURNITURE/);
  assert.match(source, /ROOM_RACK_HOTSPOTS/);
  assert.match(source, /ROOM_WALL_HOTSPOTS/);
  assert.match(source, /room-prop-hotspot/);
  assert.match(source, /room-prop-hotspot-pad/);
  assert.match(source, /coverBox\(/);
  assert.match(source, /spot\.bounds/);
  assert.match(source, /onOpenSong/);
  assert.match(source, /onOpenAchievements/);
  assert.match(source, /onOpenCollection/);
  assert.match(source, /onOpenSocial/);
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
  assert.match(source, /PIXEL_HEART_SRC/);
  assert.match(source, /spawnHeart/);
  assert.doesNotMatch(source, /♥|♡/);
  assert.match(source, /spotFromForeheadPointer/);
  assert.match(source, /sessionOrRandomWanderSpot/);
  assert.match(source, /writeSessionWanderSpot/);
  assert.match(source, /dragPastThreshold/);
  assert.match(source, /DRAG_STRUGGLE_AFTER_MS/);
  assert.match(source, /"dragging"/);
  assert.match(source, /is-struggling/);
  assert.match(source, /clearPettingFx/);
  assert.match(source, /ROOM_DRAG_Z/);
  assert.match(source, /ROOM_LABEL_Z/);
  assert.match(source, /living-room-labels/);
  assert.match(source, /reportPetLabelPose = useCallback/);
  assert.match(source, /onLabelPoseRef/);
  assert.match(source, /petStandingTop/);
  assert.match(source, /paintDepthTop/);
  assert.doesNotMatch(source, /roomStartSpot/);
  assert.doesNotMatch(css, /\.room-pet-actions/);
  assert.doesNotMatch(css, /\.room-pet-button/);
  assert.doesNotMatch(css, /\.room-pet-hand/);
  assert.match(css, /\.room-equipped/);
  assert.match(css, /\.living-room-layer/);
  assert.match(css, /\.living-room-labels/);
  assert.match(css, /\.room-pet-label-anchor/);
  assert.match(css, /\.room-pet-wrap\.is-dragging/);
  assert.match(layout, /PET_STANDING_FROM_CENTER_PCT/);
  assert.match(layout, /standingHitsObstacle/);
  assert.match(css, /room-pet-struggle/);
  assert.match(css, /rotate\(-10deg\)/);
  assert.match(css, /\.room-prop-hotspot/);
  assert.match(css, /\.room-prop-hotspot-pad/);
  assert.match(css, /\.room-rack-hotspot/);
  // Pets must not sit in a low stacking context or drag order cannot beat furniture.
  assert.match(css, /\.living-room-pets\s*\{[^}]*pointer-events:\s*none/);
  assert.doesNotMatch(css, /\.living-room-pets\s*\{[^}]*\bz-index\s*:/);
  // [^}] already spans newlines; avoid /s (needs a newer TS target than ES2017).
  assert.match(css, /\.living-room\s*\{[^}]*isolation:\s*isolate/);
  assert.match(layout, /ROOM_FLOOR_START_Y/);
  assert.match(layout, /bottomHalfObstacle/);
  assert.match(layout, /ROOM_RACK_HOTSPOTS/);
  assert.match(layout, /storage-rack/);
  assert.match(idle, /M9 34h6v4H9M27 34h6v4h-6/);
  assert.match(blush, /M11 20h5M26 20h5/);
  assert.match(struggle, /x="13\.5"[^>]*>&gt;/);
  assert.match(struggle, /x="28\.5"[^>]*>&lt;/);
  assert.match(struggle, /font-family/);
  assert.match(walk1, /M9 35h6v4H9M27 33h6v4h-6/);

  assert.match(css, /\.is-carpet/);
  for (const file of [
    "wall/base.svg",
    "floor/base.svg",
    "carpet/base.svg",
    "trim/base.svg",
    "sofa/base.svg",
    "armchair/base.svg",
    "loveseat/base.svg",
    "shelf/base.svg",
    "lamp/base.svg",
    "plant/base.svg",
    "furniture/storage-rack.svg",
  ]) {
    const svg = readFileSync(new URL(`../public/pet-assets/room/${file}`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 600 300"/);
  }

  const wall = readFileSync(new URL("../public/pet-assets/room/wall/base.svg", import.meta.url), "utf8");
  // Window sits behind the sofa (left), not the old center slot.
  assert.match(wall, /x="70"/);
  assert.doesNotMatch(wall, /x="274"/);

  const renderer = readFileSync(new URL("../components/pixel-pet.tsx", import.meta.url), "utf8");
  assert.match(renderer, /if \(!active \|\| reduceMotion\) return "idle"/);
});
