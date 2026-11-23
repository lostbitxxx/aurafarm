/**
 * FarmCrew lobby geometry in the shared 600×300 room.
 * Six study tables ring the pedestal. Anchors are where a sitting pet's feet rest.
 */

import { spotHitsObstacle, type RoomObstacle } from "@/lib/living-room-layout";
import { WANDER_SPEED_PX, type WanderSpot } from "@/lib/living-room-wander";

export const CREW_LIBRARY_PATH = "/pet-assets/room/crew/library.svg";
export const CREW_TABLE_PATH = "/pet-assets/room/crew/table.svg";

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

function seatAt(id: string, x: number, y: number): CrewSeat {
  const anchor = { left: (x / ROOM_W) * 100, top: (y / ROOM_H) * 100 };
  return {
    id,
    anchor,
    minLeft: anchor.left - 6,
    maxLeft: anchor.left + 6,
    minTop: anchor.top - 6,
    maxTop: anchor.top + 6,
  };
}

/** Back row, sides, then the front row. Pixel spots match lobby table anchors. */
export const CREW_SEATS: readonly CrewSeat[] = [
  seatAt("nw", 200, 118),
  seatAt("ne", 400, 118),
  seatAt("w", 128, 168),
  seatAt("e", 472, 168),
  seatAt("sw", 214, 214),
  seatAt("se", 386, 214),
];

/** Pixel origin of each lobby table inside the 600×300 lobby art. */
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
  { left: 18, top: 82 },
  { left: 82, top: 82 },
  { left: 36, top: 86 },
  { left: 64, top: 86 },
  { left: 50, top: 78 },
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

/**
 * Drop onto the nearest free chair whose hit box contains the spot.
 * A taken chair rejects the drop so the pet stays on the floor.
 */
export function dropOnCrewSeat(spot: WanderSpot, taken: ReadonlySet<string>): CrewSeat | null {
  let best: CrewSeat | null = null;
  let bestDist = Infinity;
  for (const seat of CREW_SEATS) {
    if (taken.has(seat.id)) continue;
    if (
      spot.left < seat.minLeft ||
      spot.left > seat.maxLeft ||
      spot.top < seat.minTop ||
      spot.top > seat.maxTop
    ) {
      continue;
    }
    const dist = Math.hypot(spot.left - seat.anchor.left, spot.top - seat.anchor.top);
    if (dist < bestDist) {
      best = seat;
      bestDist = dist;
    }
  }
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

/** Sitting pets use the chair anchor so every screen agrees on the cushion. */
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
