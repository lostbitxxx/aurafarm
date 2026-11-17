/**
 * Living-room geometry in the shared 600×300 SVG space.
 * Wall / floor / carpet / furniture layers stay aligned via the same viewBox.
 * Solid furniture collision uses a tall footprint (bottom of the bbox, starting high).
 * Carpet is floor decoration: walkable, always behind pets.
 */

export const ROOM_VIEW_WIDTH = 600;
export const ROOM_VIEW_HEIGHT = 300;

/** Floor starts here; pet feet must stay on or below this seam (not on the wall). */
export const ROOM_FLOOR_START_Y = 120;

export type RoomRectPx = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RoomObstacle = {
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
};

export type RoomFurnitureId = "loveseat" | "bookshelf" | "lamp" | "plant";

export type RoomFurniturePiece = {
  id: RoomFurnitureId;
  /** Asset under /pet-assets/room/furniture/ */
  src: string;
  /** Full drawn bbox in SVG px (for splitting / debugging). */
  bounds: RoomRectPx;
  /** Depth key: lower edge of the piece in % of room height (Y-sort). */
  depthTop: number;
  /** Footprint pets cannot enter (percent space). */
  block: RoomObstacle;
};

export function pxToLeftPercent(x: number) {
  return (x / ROOM_VIEW_WIDTH) * 100;
}

export function pxToTopPercent(y: number) {
  return (y / ROOM_VIEW_HEIGHT) * 100;
}

/**
 * Footprint obstacle from a pixel bbox.
 * `blockedFromFraction` is where the no-walk zone starts down the bbox (0 = full height,
 * 0.5 = bottom half). Smaller values push the zone higher so pets cannot tuck as deep
 * behind the piece.
 */
export function footprintObstacle(bounds: RoomRectPx, blockedFromFraction = 0.5): RoomObstacle {
  const fraction = Math.min(1, Math.max(0, blockedFromFraction));
  const startY = bounds.y + bounds.height * fraction;
  return {
    minLeft: pxToLeftPercent(bounds.x),
    maxLeft: pxToLeftPercent(bounds.x + bounds.width),
    minTop: pxToTopPercent(startY),
    maxTop: pxToTopPercent(bounds.y + bounds.height),
  };
}

/** @deprecated Prefer footprintObstacle; kept for tests that name the bottom-half case. */
export function bottomHalfObstacle(bounds: RoomRectPx): RoomObstacle {
  return footprintObstacle(bounds, 0.5);
}

export function depthTopFromBounds(bounds: RoomRectPx) {
  return pxToTopPercent(bounds.y + bounds.height);
}

const LOVESEAT_BOUNDS: RoomRectPx = { x: 33, y: 110, width: 147, height: 59 };
const BOOKSHELF_BOUNDS: RoomRectPx = { x: 471, y: 48, width: 75, height: 88 };
const LAMP_BOUNDS: RoomRectPx = { x: 183, y: 116, width: 42, height: 60 };
const PLANT_BOUNDS: RoomRectPx = { x: 509, y: 139, width: 35, height: 82 };

/**
 * Loveseat/sofa: no-walk starts high. We also seal up to the walk-band top so pets
 * cannot sit in the razor-thin strip between the wall seam and the seat.
 */
export const LOVESEAT_BLOCK_FROM = 0.28;

function piece(
  id: RoomFurnitureId,
  file: string,
  bounds: RoomRectPx,
  blockedFromFraction = 0.5,
  block: RoomObstacle = footprintObstacle(bounds, blockedFromFraction),
): RoomFurniturePiece {
  return {
    id,
    src: `/pet-assets/room/furniture/${file}`,
    bounds,
    depthTop: depthTopFromBounds(bounds),
    block,
  };
}

function loveseatBlock(): RoomObstacle {
  const block = footprintObstacle(LOVESEAT_BOUNDS, LOVESEAT_BLOCK_FROM);
  // Close the gap under the wall so left-side pets are not trapped “in” the sofa.
  return {
    ...block,
    minTop: Math.min(block.minTop, pxToTopPercent(ROOM_FLOOR_START_Y) + 2),
  };
}

/**
 * Tall wall unit: its drawn bbox reaches the floor, but pets use wrap-center for
 * depth. Sorting from the full bbox bottom tucked floor pets under the shelf.
 * Keep the collision footprint unchanged; only pull draw order toward the wall.
 */
export const BOOKSHELF_DEPTH_TOP = pxToTopPercent(ROOM_FLOOR_START_Y) - 1;

function bookshelfPiece(): RoomFurniturePiece {
  return {
    id: "bookshelf",
    src: "/pet-assets/room/furniture/bookshelf.svg",
    bounds: BOOKSHELF_BOUNDS,
    depthTop: BOOKSHELF_DEPTH_TOP,
    block: footprintObstacle(BOOKSHELF_BOUNDS, 0.5),
  };
}

/** Solid props: collision + draw-order occlusion (not carpet). */
export const ROOM_FURNITURE: readonly RoomFurniturePiece[] = [
  piece("loveseat", "loveseat.svg", LOVESEAT_BOUNDS, LOVESEAT_BLOCK_FROM, loveseatBlock()),
  piece("lamp", "lamp.svg", LAMP_BOUNDS),
  bookshelfPiece(),
  piece("plant", "plant.svg", PLANT_BOUNDS),
];

export const ROOM_WALL_SRC = "/pet-assets/room/base/wall.svg";
export const ROOM_FLOOR_SRC = "/pet-assets/room/base/floor.svg";
export const ROOM_TRIM_SRC = "/pet-assets/room/base/trim.svg";
/** Purple rug — same stack as floor; never occludes pets; walkable. */
export const ROOM_CARPET_SRC = "/pet-assets/room/base/carpet.svg";

/** Obstacles used by wander (furniture footprints only; carpet excluded). */
export const ROOM_OBSTACLES: readonly RoomObstacle[] = ROOM_FURNITURE.map((item) => item.block);

/**
 * Walk band on the floor only (includes carpet).
 * minTop sits just below the wall/floor seam so legs never stand on the wall.
 */
export const ROOM_WALK_BOUNDS = {
  minLeft: 8,
  maxLeft: 78,
  minTop: pxToTopPercent(ROOM_FLOOR_START_Y) + 2,
  maxTop: 78,
} as const;

/** Starting spots in open floor corridors (right of the loveseat column). */
export const ROOM_START_SPOTS = [
  { left: 34, top: 46 },
  { left: 42, top: 50 },
  { left: 58, top: 52 },
  { left: 70, top: 48 },
] as const;

export function roomStartSpot(index: number) {
  return ROOM_START_SPOTS[index % ROOM_START_SPOTS.length]!;
}

export function spotHitsObstacle(
  spot: { left: number; top: number },
  obstacles: readonly RoomObstacle[] = ROOM_OBSTACLES,
) {
  return obstacles.some(
    (box) =>
      spot.left >= box.minLeft &&
      spot.left <= box.maxLeft &&
      spot.top >= box.minTop &&
      spot.top <= box.maxTop,
  );
}

/** Ceiling for Y-sorted furniture / idle pets inside `.living-room`. */
export const ROOM_DEPTH_Z_MAX = 200;

/**
 * While dragging, paint above every depth-sorted layer (and the daily capsule).
 * Safe inside `.living-room { isolation: isolate }` — does not cover page dialogs.
 */
export const ROOM_DRAG_Z = ROOM_DEPTH_Z_MAX + 40;

/** z-index for Y-sort: larger top% draws in front. */
export function roomDepthZ(depthTop: number) {
  const safe = Number.isFinite(depthTop) ? depthTop : 0;
  return Math.max(1, Math.min(ROOM_DEPTH_Z_MAX, Math.round(safe * 2)));
}
