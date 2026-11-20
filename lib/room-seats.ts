/**
 * Dropping a pet onto a seat. Wander still treats the footprint as solid;
 * a seated pet is pinned to a cushion spot and skipped by the walk loop.
 */

import {
  ARMCHAIR_BOUNDS,
  LOVESEAT_BOUNDS,
  ROOM_FURNITURE,
  SOFA_BOUNDS,
  pxToLeftPercent,
  pxToTopPercent,
  roomDepthZ,
  type RoomFurnitureId,
  type RoomRectPx,
} from "@/lib/living-room-layout";
import { isFurniturePlaced, type RoomDecor } from "@/lib/room-decor";
import type { WanderSpot } from "@/lib/living-room-wander";

export type SeatPieceId = "sofa" | "armchair" | "loveseat";

export type SeatAssignment = {
  pieceId: SeatPieceId;
  seat: number;
};

export type SeatMap = Record<string, SeatAssignment>;

const SEAT_IDS: readonly SeatPieceId[] = ["sofa", "armchair", "loveseat"];

const CAPACITY: Record<SeatPieceId, Readonly<Record<string, number>>> = {
  sofa: { base: 3, greenhouse: 3, orbital: 3, leather: 3 },
  armchair: { base: 1 },
  loveseat: { base: 2 },
};

const BOUNDS: Record<SeatPieceId, RoomRectPx> = {
  sofa: SOFA_BOUNDS,
  armchair: ARMCHAIR_BOUNDS,
  loveseat: LOVESEAT_BOUNDS,
};

/** Where along the cushion the sitter's feet rest, as a fraction of the bounds height. */
const CUSHION_Y = 0.72;

export function isSeatPiece(id: RoomFurnitureId): id is SeatPieceId {
  return id === "sofa" || id === "armchair" || id === "loveseat";
}

export function seatCapacity(pieceId: SeatPieceId, decor: RoomDecor): number {
  if (!isFurniturePlaced(decor, pieceId)) return 0;
  const skin = decor.skins[pieceId];
  return CAPACITY[pieceId][skin] ?? 0;
}

function seatXs(capacity: number): number[] {
  if (capacity <= 1) return [0.5];
  const inset = 0.2;
  const span = 1 - inset * 2;
  return Array.from({ length: capacity }, (_, index) => inset + (span * index) / (capacity - 1));
}

function offsetOf(decor: RoomDecor, pieceId: SeatPieceId) {
  return decor.offsets[pieceId] ?? { dx: 0, dy: 0 };
}

export function seatAnchor(decor: RoomDecor, assignment: SeatAssignment): WanderSpot | null {
  const capacity = seatCapacity(assignment.pieceId, decor);
  if (assignment.seat < 0 || assignment.seat >= capacity) return null;
  const bounds = BOUNDS[assignment.pieceId];
  const offset = offsetOf(decor, assignment.pieceId);
  const x = seatXs(capacity)[assignment.seat] ?? 0.5;
  return {
    left: pxToLeftPercent(bounds.x + bounds.width * x) + offset.dx,
    top: pxToTopPercent(bounds.y + bounds.height * CUSHION_Y) + offset.dy,
  };
}

export function seatPaintZ(pieceId: SeatPieceId) {
  const piece = ROOM_FURNITURE.find((item) => item.id === pieceId);
  return roomDepthZ((piece?.depthTop ?? 50) + 2);
}

function hitRect(pieceId: SeatPieceId, decor: RoomDecor) {
  const bounds = BOUNDS[pieceId];
  const offset = offsetOf(decor, pieceId);
  return {
    minLeft: pxToLeftPercent(bounds.x) + offset.dx - 3,
    maxLeft: pxToLeftPercent(bounds.x + bounds.width) + offset.dx + 3,
    minTop: pxToTopPercent(bounds.y) + offset.dy - 12,
    maxTop: pxToTopPercent(bounds.y + bounds.height) + offset.dy + 6,
  };
}

function contains(pieceId: SeatPieceId, decor: RoomDecor, spot: WanderSpot) {
  const box = hitRect(pieceId, decor);
  return spot.left >= box.minLeft && spot.left <= box.maxLeft && spot.top >= box.minTop && spot.top <= box.maxTop;
}

function seatTaken(seats: SeatMap, pieceId: SeatPieceId, seat: number, exceptPetId: string) {
  return Object.entries(seats).some(
    ([petId, assignment]) => petId !== exceptPetId && assignment.pieceId === pieceId && assignment.seat === seat,
  );
}

export function dropOnSeat(
  decor: RoomDecor,
  seats: SeatMap,
  petId: string,
  spot: WanderSpot,
): { seats: SeatMap; spot: WanderSpot } | null {
  let best: { assignment: SeatAssignment; anchor: WanderSpot; dist: number } | null = null;
  for (const pieceId of SEAT_IDS) {
    const capacity = seatCapacity(pieceId, decor);
    if (capacity < 1 || !contains(pieceId, decor, spot)) continue;
    for (let seat = 0; seat < capacity; seat += 1) {
      if (seatTaken(seats, pieceId, seat, petId)) continue;
      const assignment = { pieceId, seat };
      const anchor = seatAnchor(decor, assignment);
      if (!anchor) continue;
      const dist = (anchor.left - spot.left) ** 2 + (anchor.top - spot.top) ** 2;
      if (!best || dist < best.dist) best = { assignment, anchor, dist };
    }
  }
  if (!best) return null;
  const next: SeatMap = { ...seats, [petId]: best.assignment };
  return { seats: next, spot: best.anchor };
}

export function seatsEqual(a: SeatMap, b: SeatMap) {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key]?.pieceId === b[key]?.pieceId && a[key]?.seat === b[key]?.seat);
}

export function liftSeat(seats: SeatMap, petId: string): SeatMap {
  if (!seats[petId]) return seats;
  const next = { ...seats };
  delete next[petId];
  return next;
}

export function reconcileSeats(decor: RoomDecor, seats: SeatMap): SeatMap {
  const used = new Set<string>();
  const next: SeatMap = {};
  for (const [petId, assignment] of Object.entries(seats)) {
    if (!assignment || !isSeatPiece(assignment.pieceId)) continue;
    const capacity = seatCapacity(assignment.pieceId, decor);
    if (!Number.isInteger(assignment.seat) || assignment.seat < 0 || assignment.seat >= capacity) continue;
    const key = `${assignment.pieceId}:${assignment.seat}`;
    if (used.has(key)) continue;
    used.add(key);
    next[petId] = { pieceId: assignment.pieceId, seat: assignment.seat };
  }
  return next;
}

function storageKey(userId: string) {
  return `aurafarm.room-seats.${userId}`;
}

export function parseRoomSeats(raw: string | null): SeatMap {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const next: SeatMap = {};
  for (const [petId, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object") continue;
    const assignment = value as Partial<SeatAssignment>;
    if (assignment.pieceId !== "sofa" && assignment.pieceId !== "armchair" && assignment.pieceId !== "loveseat") {
      continue;
    }
    if (!Number.isInteger(assignment.seat) || (assignment.seat ?? -1) < 0 || (assignment.seat ?? 0) > 2) continue;
    next[petId] = { pieceId: assignment.pieceId, seat: assignment.seat as number };
  }
  return next;
}

export function readRoomSeats(userId: string): SeatMap {
  if (typeof window === "undefined") return {};
  try {
    return parseRoomSeats(window.localStorage.getItem(storageKey(userId)));
  } catch {
    return {};
  }
}

export function writeRoomSeats(userId: string, seats: SeatMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(seats));
}
