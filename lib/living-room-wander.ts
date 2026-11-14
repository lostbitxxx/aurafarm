/** Pure helpers for Living Room idle / stroll motion (in-memory only). */

export const WALK_BOUNDS = { minLeft: 8, maxLeft: 78, minTop: 42, maxTop: 58 };

/** Horizontal stroll speed in CSS pixels per second of the room box. */
export const WANDER_SPEED_PX = 18;

/** Vertical speed as a fraction of horizontal (room perspective). */
export const WANDER_VERTICAL_RATIO = 0.68;

/** Cap a single rAF step so a background tab return does not jump. */
export const WANDER_MAX_DT_SEC = 0.05;

export const WALK_DURATION_MS = { min: 1500, max: 7000 } as const;
export const IDLE_DURATION_MS = { min: 2000, max: 6000 } as const;

/** How long after the last stroke/button press before petting ends (existing blush hold). */
export const PETTING_HOLD_MS = 1500;

export type WanderSpot = { left: number; top: number };
export type WanderDir = { x: number; y: number };

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
 * Advance a %-based spot by a normalized direction and room pixel size.
 * Returns the clamped spot and whether a bound was hit (caller should idle).
 */
export function stepWanderSpot(
  spot: WanderSpot,
  dir: WanderDir,
  dtSec: number,
  room: { width: number; height: number },
  bounds = WALK_BOUNDS,
  speedPx = WANDER_SPEED_PX,
  verticalRatio = WANDER_VERTICAL_RATIO,
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
  const left = Math.min(bounds.maxLeft, Math.max(bounds.minLeft, nextLeft));
  const top = Math.min(bounds.maxTop, Math.max(bounds.minTop, nextTop));
  const hitBound =
    nextLeft < bounds.minLeft ||
    nextLeft > bounds.maxLeft ||
    nextTop < bounds.minTop ||
    nextTop > bounds.maxTop;
  const moved = Math.abs(left - spot.left) > 1e-4 || Math.abs(top - spot.top) > 1e-4;
  return { spot: { left, top }, hitBound, moved };
}

/** Facing flips only when horizontal motion dominates (avoids flicker on near-vertical walks). */
export function facingFromDirection(dir: WanderDir, currentFaceLeft: boolean): boolean {
  if (Math.abs(dir.x) < 0.35 || Math.abs(dir.x) < Math.abs(dir.y) * 0.85) {
    return currentFaceLeft;
  }
  return dir.x < 0;
}
