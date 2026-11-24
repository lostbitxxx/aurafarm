/** Pure helpers for Living Room idle / stroll motion (in-memory only). */

import {
  petStandingTop,
  ROOM_OBSTACLES,
  ROOM_START_SPOTS,
  ROOM_WALK_BOUNDS,
  spotHitsObstacle,
  standingHitsObstacle,
  wrapCenterFromStanding,
  type RoomObstacle,
} from "@/lib/living-room-layout";

export const WALK_BOUNDS = ROOM_WALK_BOUNDS;

/** Horizontal stroll speed in CSS pixels per second of the room box. */
export const WANDER_SPEED_PX = 36;

/** Vertical speed as a fraction of horizontal (room perspective). */
export const WANDER_VERTICAL_RATIO = 0.68;

/** Cap a single rAF step so a background tab return does not jump. */
export const WANDER_MAX_DT_SEC = 0.05;

export const WALK_DURATION_MS = { min: 1500, max: 7000 } as const;
export const IDLE_DURATION_MS = { min: 2000, max: 6000 } as const;

/** How long after the last stroke/button press before petting ends (existing blush hold). */
export const PETTING_HOLD_MS = 1500;

/** Pointer travel (px) before a press becomes a drag instead of click/petting. */
export const DRAG_START_PX = 8;

/** Continuous grab duration before the pet starts the struggle swing. */
export const DRAG_STRUGGLE_AFTER_MS = 1500;

/** Struggle swing amplitude (degrees) around the forehead pivot. */
export const DRAG_STRUGGLE_DEG = 10;

/**
 * Forehead grab point above the wrap center (translate -50%/-50%).
 * Fraction of the room-pet wrap height — lower values sit the pet higher under the cursor.
 */
export const FOREHEAD_OFFSET_Y_RATIO = 0.12;

/** Clearance past an obstacle edge when ejecting a stuck pet (% of room). */
export const OBSTACLE_EJECT_PAD = 1.25;

export type WanderSpot = { left: number; top: number };
export type WanderDir = { x: number; y: number };
export type WalkBounds = {
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
};

export function randomBetween(min: number, max: number, rand: () => number = Math.random) {
  return min + rand() * (max - min);
}

export function normalize2d(x: number, y: number): WanderDir {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function pickWalkDirection(rand: () => number = Math.random): WanderDir {
  const angle = rand() * Math.PI * 2;
  return normalize2d(Math.cos(angle), Math.sin(angle));
}

export function randomWalkMs(rand: () => number = Math.random) {
  return randomBetween(WALK_DURATION_MS.min, WALK_DURATION_MS.max, rand);
}

export function randomIdleMs(rand: () => number = Math.random) {
  return randomBetween(IDLE_DURATION_MS.min, IDLE_DURATION_MS.max, rand);
}

/**
 * Pick a walkable floor spot for spawn / refresh (avoids furniture footprints).
 * Falls back through start corridors, then resolveWanderSpot, if sampling fails.
 */
export function randomWanderSpot(
  rand: () => number = Math.random,
  bounds: WalkBounds = WALK_BOUNDS,
  obstacles: readonly RoomObstacle[] = ROOM_OBSTACLES,
  attempts = 48,
): WanderSpot {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = {
      left: randomBetween(bounds.minLeft, bounds.maxLeft, rand),
      top: randomBetween(bounds.minTop, bounds.maxTop, rand),
    };
    if (!standingHitsObstacle(candidate, obstacles)) return candidate;
  }
  for (const candidate of ROOM_START_SPOTS) {
    const next = clampSpotToWalkBand(candidate, bounds, "floor");
    if (!standingHitsObstacle(next, obstacles)) return next;
  }
  return resolveWanderSpot(
    {
      left: randomBetween(bounds.minLeft, bounds.maxLeft, rand),
      top: randomBetween(bounds.minTop, bounds.maxTop, rand),
    },
    bounds,
    obstacles,
  );
}

/** In-memory only — survives Living Room remounts, cleared on full page refresh. */
const sessionWanderSpots = new Map<string, WanderSpot>();

/** Test helper: wipe session spots between cases. */
export function clearSessionWanderSpots() {
  sessionWanderSpots.clear();
}

export function writeSessionWanderSpot(petId: string, spot: WanderSpot) {
  sessionWanderSpots.set(petId, spot);
}

export function readSessionWanderSpot(petId: string): WanderSpot | null {
  return sessionWanderSpots.get(petId) ?? null;
}

/**
 * Session-only placement: reuse this tab's last spot for the pet, else roll a random walkable one.
 * Not written to localStorage / the account.
 */
export function sessionOrRandomWanderSpot(petId: string, rand: () => number = Math.random): WanderSpot {
  const saved = sessionWanderSpots.get(petId);
  if (saved) {
    const freed = resolveWanderSpot(saved);
    sessionWanderSpots.set(petId, freed);
    return freed;
  }
  const rolled = randomWanderSpot(rand);
  sessionWanderSpots.set(petId, rolled);
  return rolled;
}

/**
 * Advance a %-based spot by a normalized direction and room pixel size.
 * Returns the clamped spot and whether a bound or furniture footprint was hit.
 */
export function stepWanderSpot(
  spot: WanderSpot,
  dir: WanderDir,
  dtSec: number,
  room: { width: number; height: number },
  bounds: WalkBounds = WALK_BOUNDS,
  speedPx = WANDER_SPEED_PX,
  verticalRatio = WANDER_VERTICAL_RATIO,
  obstacles: readonly RoomObstacle[] = ROOM_OBSTACLES,
): { spot: WanderSpot; hitBound: boolean; moved: boolean } {
  const width = Math.max(room.width, 1);
  const height = Math.max(room.height, 1);
  const dt = Math.min(Math.max(dtSec, 0), WANDER_MAX_DT_SEC);
  const unit = normalize2d(dir.x, dir.y);
  if (unit.x === 0 && unit.y === 0) {
    return { spot, hitBound: false, moved: false };
  }

  const nextLeft = spot.left + ((unit.x * speedPx * dt) / width) * 100;
  const nextTop = spot.top + ((unit.y * speedPx * verticalRatio * dt) / height) * 100;
  const candidate = clampSpotToWalkBand({ left: nextLeft, top: nextTop }, bounds, "floor");
  const nextStanding = petStandingTop(nextTop, "floor");
  const hitEdge =
    nextLeft < bounds.minLeft ||
    nextLeft > bounds.maxLeft ||
    nextStanding < bounds.minTop ||
    nextStanding > bounds.maxTop;

  if (standingHitsObstacle(candidate, obstacles)) {
    return { spot, hitBound: true, moved: false };
  }

  const moved = Math.abs(candidate.left - spot.left) > 1e-4 || Math.abs(candidate.top - spot.top) > 1e-4;
  return { spot: candidate, hitBound: hitEdge, moved };
}

/** Facing flips only when horizontal motion dominates (avoids flicker on near-vertical walks). */
export function facingFromDirection(dir: WanderDir, currentFaceLeft: boolean): boolean {
  if (Math.abs(dir.x) < 0.35 || Math.abs(dir.x) < Math.abs(dir.y) * 0.85) {
    return currentFaceLeft;
  }
  return dir.x < 0;
}

/**
 * Clamp a spot into the walk band.
 * - `point`: `top` is already the standing line / seat anchor (FarmCrew).
 * - `floor`: `top` is wrap center; clamp the standing line, then store center again.
 */
export function clampSpotToWalkBand(
  spot: WanderSpot,
  bounds: WalkBounds = WALK_BOUNDS,
  mode: "floor" | "point" = "point",
): WanderSpot {
  const left = Math.min(bounds.maxLeft, Math.max(bounds.minLeft, spot.left));
  if (mode === "point") {
    return {
      left,
      top: Math.min(bounds.maxTop, Math.max(bounds.minTop, spot.top)),
    };
  }
  const standing = petStandingTop(spot.top, "floor");
  const clampedStanding = Math.min(bounds.maxTop, Math.max(bounds.minTop, standing));
  return { left, top: wrapCenterFromStanding(clampedStanding) };
}

function hitsBox(spot: WanderSpot, box: RoomObstacle) {
  return (
    spot.left >= box.minLeft &&
    spot.left <= box.maxLeft &&
    spot.top >= box.minTop &&
    spot.top <= box.maxTop
  );
}

/** Push outside a single obstacle via the nearest edge (with padding). */
export function ejectFromObstacle(
  spot: WanderSpot,
  box: RoomObstacle,
  bounds: WalkBounds = WALK_BOUNDS,
  pad = OBSTACLE_EJECT_PAD,
  mode: "floor" | "point" = "point",
): WanderSpot[] {
  const above =
    mode === "floor" ? wrapCenterFromStanding(box.minTop - pad) : box.minTop - pad;
  const below =
    mode === "floor" ? wrapCenterFromStanding(box.maxTop + pad) : box.maxTop + pad;
  return [
    { left: box.maxLeft + pad, top: spot.top },
    { left: box.minLeft - pad, top: spot.top },
    { left: spot.left, top: below },
    { left: spot.left, top: above },
    { left: box.maxLeft + pad, top: above },
    { left: box.maxLeft + pad, top: below },
  ].map((candidate) => clampSpotToWalkBand(candidate, bounds, mode));
}

/**
 * If a pet is already inside a no-go footprint (e.g. sofa zone grew), push it to a safe spot.
 * Walks right/around overlapping props (sofa → lamp) then falls back to open start corridors.
 * `mode: "floor"` uses the standing line; `"point"` treats `top` as the contact point (FarmCrew).
 */
export function resolveWanderSpot(
  spot: WanderSpot,
  bounds: WalkBounds = WALK_BOUNDS,
  obstacles: readonly RoomObstacle[] = ROOM_OBSTACLES,
  fallbacks: readonly WanderSpot[] = ROOM_START_SPOTS,
  mode: "floor" | "point" = "floor",
): WanderSpot {
  const blocked = (candidate: WanderSpot) =>
    mode === "floor" ? standingHitsObstacle(candidate, obstacles) : spotHitsObstacle(candidate, obstacles);
  const probe = (candidate: WanderSpot) =>
    mode === "floor"
      ? { left: candidate.left, top: petStandingTop(candidate.top, "floor") }
      : candidate;

  let current = clampSpotToWalkBand(spot, bounds, mode);
  if (!blocked(current)) return current;

  // Prefer open floor to the right of left-wall furniture; iterate if another prop blocks.
  for (let step = 0; step < 8; step += 1) {
    if (!blocked(current)) return current;
    const box = obstacles.find((item) => hitsBox(probe(current), item));
    if (!box) break;
    const midTop =
      mode === "floor"
        ? wrapCenterFromStanding((bounds.minTop + bounds.maxTop) / 2)
        : (bounds.minTop + bounds.maxTop) / 2;
    const ranked = [
      { left: box.maxLeft + OBSTACLE_EJECT_PAD, top: current.top },
      { left: box.maxLeft + OBSTACLE_EJECT_PAD, top: midTop },
      ...ejectFromObstacle(current, box, bounds, OBSTACLE_EJECT_PAD, mode),
    ];
    let advanced = false;
    for (const candidate of ranked) {
      const next = clampSpotToWalkBand(candidate, bounds, mode);
      if (next.left === current.left && next.top === current.top) continue;
      current = next;
      advanced = true;
      break;
    }
    if (!advanced) break;
  }
  if (!blocked(current)) return current;

  for (const candidate of fallbacks) {
    const next = clampSpotToWalkBand(candidate, bounds, mode);
    if (!blocked(next)) return next;
  }

  const offsets: WanderDir[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: -1 },
    { x: -1, y: 1 },
  ];
  for (let radius = 1; radius <= 40; radius += 1) {
    for (const dir of offsets) {
      const next = clampSpotToWalkBand(
        { left: current.left + dir.x * radius, top: current.top + dir.y * radius },
        bounds,
        mode,
      );
      if (!blocked(next)) return next;
    }
  }

  return clampSpotToWalkBand(
    { left: bounds.maxLeft, top: (bounds.minTop + bounds.maxTop) / 2 },
    bounds,
    mode,
  );
}

/**
 * Map a pointer position inside the room box to a pet spot whose forehead sits under the cursor.
 * `wrapHeightPx` is the room-pet wrap height; offset is converted into room-% space.
 */
export function spotFromForeheadPointer(
  pointerLeftPct: number,
  pointerTopPct: number,
  room: { width: number; height: number },
  wrapHeightPx: number,
  foreheadRatio = FOREHEAD_OFFSET_Y_RATIO,
): WanderSpot {
  const height = Math.max(room.height, 1);
  const wrap = Math.max(wrapHeightPx, 1);
  const offsetTopPct = ((foreheadRatio * wrap) / height) * 100;
  return {
    left: pointerLeftPct,
    top: pointerTopPct + offsetTopPct,
  };
}

/** Convert a client point to % of a room element's content box. */
export function pointerPercentInRoom(
  clientX: number,
  clientY: number,
  room: DOMRect | { left: number; top: number; width: number; height: number },
): { left: number; top: number } {
  const width = Math.max(room.width, 1);
  const height = Math.max(room.height, 1);
  return {
    left: ((clientX - room.left) / width) * 100,
    top: ((clientY - room.top) / height) * 100,
  };
}

/** True once the pointer has moved far enough to count as a drag. */
export function dragPastThreshold(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  thresholdPx = DRAG_START_PX,
) {
  return Math.hypot(clientX - startX, clientY - startY) >= thresholdPx;
}
