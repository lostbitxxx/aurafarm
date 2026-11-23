/**
 * FarmCrew lobby geometry in the shared 600×300 room.
 * Six study seats ring the pedestal. Anchors are where a sitting pet's feet rest.
 */

import { spotHitsObstacle, type RoomObstacle } from "@/lib/living-room-layout";
import {
  clampSpotToWalkBand,
  ejectFromObstacle,
  resolveWanderSpot,
  WANDER_SPEED_PX,
  type WanderSpot,
} from "@/lib/living-room-wander";

export const CREW_LIBRARY_PATH = "/pet-assets/room/crew/library.svg";
export const CREW_SEATS_PATH = "/pet-assets/room/crew/seats.svg";

/** Right-wall blackboard. Same box the library shelf used to fill. */
export const CREW_BLACKBOARD = { x: 492, y: 18, width: 92, height: 86 };

export type CrewPoseMode = "idle" | "walking" | "sitting" | "dragging";

export type CrewPose = {
  userId: string;
  left: number;
  top: number;
  mode: CrewPoseMode;
  seatId: string | null;
  faceLeft: boolean;
  /** Server time of this pose. Missing on a local publish echo. */
  updatedAt?: string;
};

export type CrewSeat = {
  id: string;
  anchor: WanderSpot;
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
};

const ROOM_W = 600;
const ROOM_H = 300;
/**
 * Same rectangle as `.crew-lobby-seat`:
 * width 56/600, height 44/300, transform translate(-50%, -78%).
 * Anchor sits halfway across and 78% down that box for every seat.
 */
const SEAT_WIDTH_PCT = (56 / ROOM_W) * 100;
const SEAT_HEIGHT_PCT = (44 / ROOM_H) * 100;
const SEAT_ANCHOR_X = 0.5;
const SEAT_ANCHOR_Y = 0.78;
/** Same extra grab on every seat so a pet dropped in front of the legs still sits. */
const SEAT_PAD_X = 1.5;
const SEAT_PAD_BOTTOM = 8;
const SEAT_EJECT_PAD = 1.25;

function seatAt(id: string, x: number, y: number): CrewSeat {
  const anchor = { left: (x / ROOM_W) * 100, top: (y / ROOM_H) * 100 };
  const minLeft = anchor.left - SEAT_WIDTH_PCT * SEAT_ANCHOR_X - SEAT_PAD_X;
  const maxLeft = anchor.left + SEAT_WIDTH_PCT * (1 - SEAT_ANCHOR_X) + SEAT_PAD_X;
  const minTop = anchor.top - SEAT_HEIGHT_PCT * SEAT_ANCHOR_Y;
  const maxTop = anchor.top + SEAT_HEIGHT_PCT * (1 - SEAT_ANCHOR_Y) + SEAT_PAD_BOTTOM;
  return { id, anchor, minLeft, maxLeft, minTop, maxTop };
}

/** Back row, sides, then the front row. Pixel spots match lobby seat anchors. */
export const CREW_SEATS: readonly CrewSeat[] = [
  seatAt("nw", 200, 118),
  seatAt("ne", 400, 118),
  seatAt("w", 128, 168),
  seatAt("e", 472, 168),
  seatAt("sw", 214, 214),
  seatAt("se", 386, 214),
];

/** Pixel origin of each lobby seat inside the 600×300 lobby art. */
export function crewTablePixel(seatId: string): { x: number; y: number } | null {
  const seat = crewSeatById(seatId);
  if (!seat) return null;
  return {
    x: (seat.anchor.left / 100) * ROOM_W,
    y: (seat.anchor.top / 100) * ROOM_H,
  };
}

/** Feet of the communal pet, on the pedestal slab. */
export const CREW_PEDESTAL: WanderSpot = { left: 50, top: (138 / ROOM_H) * 100 };

export const CREW_WALK_BOUNDS = {
  minLeft: 8,
  maxLeft: 92,
  minTop: 48,
  maxTop: 88,
};

export const CREW_OBSTACLES: readonly RoomObstacle[] = [
  { minLeft: 43, maxLeft: 57, minTop: 42, maxTop: 66 },
  { minLeft: 26, maxLeft: 42, minTop: 26, maxTop: 50 },
  { minLeft: 58, maxLeft: 74, minTop: 26, maxTop: 50 },
  { minLeft: 14, maxLeft: 30, minTop: 42, maxTop: 66 },
  { minLeft: 70, maxLeft: 86, minTop: 42, maxTop: 66 },
  { minLeft: 28, maxLeft: 44, minTop: 58, maxTop: 80 },
  { minLeft: 56, maxLeft: 72, minTop: 58, maxTop: 80 },
];

export const CREW_START_SPOTS: readonly WanderSpot[] = [
  { left: 50, top: 86 },
  { left: 12, top: 88 },
  { left: 90, top: 88 },
  { left: 50, top: 78 },
  { left: 50, top: 70 },
  { left: 50, top: 36 },
];

const SEAT_IDS = new Set(CREW_SEATS.map((seat) => seat.id));

export function crewSeatById(id: string | null | undefined): CrewSeat | null {
  if (!id) return null;
  return CREW_SEATS.find((seat) => seat.id === id) ?? null;
}

/** Same farmer always appears in the same open spot until their pose arrives. */
export function crewSpawnSpot(userId: string): WanderSpot {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (Math.imul(hash, 33) + userId.charCodeAt(i)) >>> 0;
  }
  return CREW_START_SPOTS[hash % CREW_START_SPOTS.length];
}

export function spotInCrewSeat(spot: WanderSpot, seat: CrewSeat): boolean {
  return (
    spot.left >= seat.minLeft &&
    spot.left <= seat.maxLeft &&
    spot.top >= seat.minTop &&
    spot.top <= seat.maxTop
  );
}

/** True when the spot sits inside any lobby seat hitbox. */
export function spotInAnyCrewSeat(spot: WanderSpot): boolean {
  return CREW_SEATS.some((seat) => spotInCrewSeat(spot, seat));
}

/**
 * Same margin around every table sprite. Measured to the drawn desk, not the
 * foot anchor, so the back-row chairs cannot swallow the 5 o'clock tabletop.
 */
const SEAT_REACH = 8;

function spriteBox(seat: CrewSeat) {
  return {
    left: seat.anchor.left - SEAT_WIDTH_PCT * SEAT_ANCHOR_X,
    right: seat.anchor.left + SEAT_WIDTH_PCT * (1 - SEAT_ANCHOR_X),
    top: seat.anchor.top - SEAT_HEIGHT_PCT * SEAT_ANCHOR_Y,
    bottom: seat.anchor.top + SEAT_HEIGHT_PCT * (1 - SEAT_ANCHOR_Y),
  };
}

function distanceToSprite(spot: WanderSpot, seat: CrewSeat): number {
  const box = spriteBox(seat);
  const dx = spot.left < box.left ? box.left - spot.left : spot.left > box.right ? spot.left - box.right : 0;
  const dy = spot.top < box.top ? box.top - spot.top : spot.top > box.bottom ? spot.top - box.bottom : 0;
  return Math.hypot(dx, dy);
}

/**
 * Drop onto the closest free seat whose table is under the spot.
 * A taken closest seat rejects the drop so the pet does not hop to another chair.
 */
export function dropOnCrewSeat(spot: WanderSpot, taken: ReadonlySet<string>): CrewSeat | null {
  let best: CrewSeat | null = null;
  let bestDist = Infinity;
  for (const seat of CREW_SEATS) {
    const dist = distanceToSprite(spot, seat);
    if (dist > SEAT_REACH || dist >= bestDist) continue;
    best = seat;
    bestDist = dist;
  }
  if (!best || taken.has(best.id)) return null;
  return best;
}

/**
 * Move a remote pet toward the latest pose at about walking speed.
 * A long gap snaps, so a pet that just appeared does not crawl across the room.
 * Sitting snaps onto the chair. Walking and dragging keep a steady pace and
 * speed up a little when they fall behind.
 */
export function followCrewPose(
  current: WanderSpot,
  target: WanderSpot,
  mode: CrewPoseMode | undefined,
  dtSec: number,
  room: { width: number; height: number },
): WanderSpot {
  const width = Math.max(room.width, 1);
  const height = Math.max(room.height, 1);
  const dx = ((target.left - current.left) / 100) * width;
  const dy = ((target.top - current.top) / 100) * height;
  const dist = Math.hypot(dx, dy);
  if (mode === "sitting" || dist > 110 || dist < 0.4) return target;
  const dt = Math.min(Math.max(dtSec, 0), 0.05);
  const base =
    mode === "dragging" ? WANDER_SPEED_PX * 4.5 : mode === "walking" ? WANDER_SPEED_PX : WANDER_SPEED_PX * 1.8;
  const catchup = Math.min(2.2, Math.max(1, dist / 16));
  const step = Math.min(dist, base * catchup * dt);
  const scale = step / dist;
  return {
    left: current.left + ((dx * scale) / width) * 100,
    top: current.top + ((dy * scale) / height) * 100,
  };
}

function seatBoxes(): RoomObstacle[] {
  return CREW_SEATS.map((seat) => ({
    minLeft: seat.minLeft,
    maxLeft: seat.maxLeft,
    minTop: seat.minTop,
    maxTop: seat.maxTop,
  }));
}

function isCrewFloorSafe(spot: WanderSpot): boolean {
  const clamped = clampSpotToWalkBand(spot, CREW_WALK_BOUNDS);
  if (clamped.left !== spot.left || clamped.top !== spot.top) return false;
  if (spotHitsObstacle(spot, CREW_OBSTACLES)) return false;
  if (spotInAnyCrewSeat(spot)) return false;
  return true;
}

/**
 * Push off occupied seat hitboxes (and room obstacles) onto open floor that
 * will not immediately re-trigger another sit zone.
 */
export function ejectFromCrewSeats(spot: WanderSpot): WanderSpot {
  let current = clampSpotToWalkBand(spot, CREW_WALK_BOUNDS);
  if (isCrewFloorSafe(current)) return current;

  const blocks = [...seatBoxes(), ...CREW_OBSTACLES];
  for (let step = 0; step < 12; step += 1) {
    if (isCrewFloorSafe(current)) return current;
    const box = blocks.find(
      (item) =>
        current.left >= item.minLeft &&
        current.left <= item.maxLeft &&
        current.top >= item.minTop &&
        current.top <= item.maxTop,
    );
    if (!box) break;
    const ranked = [
      { left: box.maxLeft + SEAT_EJECT_PAD, top: current.top },
      { left: box.minLeft - SEAT_EJECT_PAD, top: current.top },
      { left: current.left, top: box.maxTop + SEAT_EJECT_PAD },
      { left: current.left, top: box.minTop - SEAT_EJECT_PAD },
      ...ejectFromObstacle(current, box, CREW_WALK_BOUNDS, SEAT_EJECT_PAD),
    ];
    let advanced = false;
    for (const candidate of ranked) {
      const next = clampSpotToWalkBand(candidate, CREW_WALK_BOUNDS);
      if (next.left === current.left && next.top === current.top) continue;
      current = next;
      advanced = true;
      break;
    }
    if (!advanced) break;
  }

  if (isCrewFloorSafe(current)) return current;

  let best: WanderSpot | null = null;
  let bestDist = Infinity;
  for (const candidate of CREW_START_SPOTS) {
    const next = clampSpotToWalkBand(candidate, CREW_WALK_BOUNDS);
    if (!isCrewFloorSafe(next)) continue;
    const dist = Math.hypot(next.left - spot.left, next.top - spot.top);
    if (dist < bestDist) {
      best = next;
      bestDist = dist;
    }
  }
  if (best) return best;

  const freed = resolveWanderSpot(current, CREW_WALK_BOUNDS, CREW_OBSTACLES, CREW_START_SPOTS, "point");
  if (isCrewFloorSafe(freed)) return freed;

  // Last resort: spiral search for open floor outside every sit zone.
  for (let radius = 1; radius <= 40; radius += 1) {
    for (const dir of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: -1, y: 1 },
    ]) {
      const next = clampSpotToWalkBand(
        { left: current.left + dir.x * radius * 0.75, top: current.top + dir.y * radius * 0.75 },
        CREW_WALK_BOUNDS,
      );
      if (isCrewFloorSafe(next)) return next;
    }
  }
  return freed;
}

/**
 * Finish a drag: sit on a free seat under the spot, else stand on open floor
 * that does not land inside any sit hitbox (occupied seats eject clear).
 */
export function resolveCrewDrop(
  spot: WanderSpot,
  taken: ReadonlySet<string>,
): { seat: CrewSeat | null; spot: WanderSpot } {
  const seat = dropOnCrewSeat(spot, taken);
  if (seat) return { seat, spot: seat.anchor };
  if (spotInAnyCrewSeat(spot) || spotHitsObstacle(spot, CREW_OBSTACLES)) {
    return { seat: null, spot: ejectFromCrewSeats(spot) };
  }
  const freed = resolveWanderSpot(spot, CREW_WALK_BOUNDS, CREW_OBSTACLES, CREW_START_SPOTS, "point");
  if (spotInAnyCrewSeat(freed)) return { seat: null, spot: ejectFromCrewSeats(freed) };
  return { seat: null, spot: freed };
}

/** Sitting pets use the seat anchor so every screen agrees on the cushion. */
export function crewDisplaySpot(pose: CrewPose): WanderSpot {
  if (pose.mode === "sitting") {
    const seat = crewSeatById(pose.seatId);
    if (seat) return seat.anchor;
  }
  return { left: pose.left, top: pose.top };
}

export function poseFromRow(row: {
  user_id?: unknown;
  left_pct?: unknown;
  top_pct?: unknown;
  mode?: unknown;
  seat_id?: unknown;
  face_left?: unknown;
  updated_at?: unknown;
}): CrewPose | null {
  if (typeof row.user_id !== "string") return null;
  if (row.mode !== "idle" && row.mode !== "walking" && row.mode !== "sitting" && row.mode !== "dragging") {
    return null;
  }
  const left = Number(row.left_pct);
  const top = Number(row.top_pct);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  const seatId = typeof row.seat_id === "string" && SEAT_IDS.has(row.seat_id) ? row.seat_id : null;
  const pose: CrewPose = {
    userId: row.user_id,
    left,
    top,
    mode: row.mode,
    seatId: row.mode === "sitting" ? seatId : null,
    faceLeft: row.face_left === true,
  };
  if (typeof row.updated_at === "string") {
    const at = Date.parse(row.updated_at);
    if (Number.isFinite(at)) pose.updatedAt = new Date(at).toISOString();
  }
  return pose;
}

/** Keep the pose that the server wrote later. A local echo has no timestamp. */
export function newerCrewPose(current: CrewPose | undefined, incoming: CrewPose): CrewPose {
  if (!current) return incoming;
  if (!incoming.updatedAt) return current.updatedAt ? current : incoming;
  if (!current.updatedAt) return incoming;
  const currentAt = Date.parse(current.updatedAt);
  const incomingAt = Date.parse(incoming.updatedAt);
  if (!Number.isFinite(incomingAt)) return Number.isFinite(currentAt) ? current : incoming;
  if (!Number.isFinite(currentAt) || incomingAt >= currentAt) return incoming;
  return current;
}

export function crewStartSpotsAreOpen() {
  return CREW_START_SPOTS.every((spot) => !spotHitsObstacle(spot, CREW_OBSTACLES));
}
