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

export type RoomFurnitureId = "loveseat" | "bookshelf" | "lamp" | "plant" | "storage-rack" | "blackboard";

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

/** Clickable prop on the storage rack (opens a desk dialog). */
export type RoomRackHotspotId = "song" | "achievements" | "collection";

export type RoomRackHotspot = {
  id: RoomRackHotspotId;
  label: string;
  /** Hit area in room percent space (matches CSS absolute box). */
  box: RoomObstacle;
};

/** Wall blackboard hotspot (Blackboard panel). */
export type RoomWallHotspotId = "blackboard";

export type RoomWallHotspot = {
  id: RoomWallHotspotId;
  label: string;
  /** Tutorial target id (kept as "social" for the desk tour). */
  tutorialTarget: "social";
  box: RoomObstacle;
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
/** Between the lamp and the bookshelf, mid-back wall. Pixel art is 320×160 (2:1). */
const STORAGE_RACK_BOUNDS: RoomRectPx = { x: 292, y: 78, width: 130, height: 65 };
/** On the wall above and slightly left of the storage rack. */
const BLACKBOARD_BOUNDS: RoomRectPx = { x: 248, y: 22, width: 100, height: 48 };

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

/**
 * Back-wall storage rack: same depth treatment as the bookshelf so floor pets
 * paint in front. Collision is the drawer band only (bottom half).
 */
export const STORAGE_RACK_DEPTH_TOP = pxToTopPercent(ROOM_FLOOR_START_Y) - 1;

function storageRackPiece(): RoomFurniturePiece {
  return {
    id: "storage-rack",
    src: "/pet-assets/room/furniture/storage-rack.svg",
    bounds: STORAGE_RACK_BOUNDS,
    depthTop: STORAGE_RACK_DEPTH_TOP,
    block: footprintObstacle(STORAGE_RACK_BOUNDS, 0.55),
  };
}

/** Wall board hangs above the floor; no walk collision. */
export const BLACKBOARD_DEPTH_TOP = BOOKSHELF_DEPTH_TOP;

function blackboardPiece(): RoomFurniturePiece {
  return {
    id: "blackboard",
    src: "/pet-assets/room/furniture/blackboard.svg",
    bounds: BLACKBOARD_BOUNDS,
    depthTop: BLACKBOARD_DEPTH_TOP,
    block: {
      minLeft: 0,
      maxLeft: 0,
      minTop: 0,
      maxTop: 0,
    },
  };
}

function hotspotBox(bounds: RoomRectPx): RoomObstacle {
  return {
    minLeft: pxToLeftPercent(bounds.x),
    maxLeft: pxToLeftPercent(bounds.x + bounds.width),
    minTop: pxToTopPercent(bounds.y),
    maxTop: pxToTopPercent(bounds.y + bounds.height),
  };
}

/** Gramophone / trophy / clothes-shelf+drawer hit areas on the storage rack. */
export const ROOM_RACK_HOTSPOTS: readonly RoomRackHotspot[] = [
  {
    id: "song",
    label: "Song",
    // Left top: gramophone
    box: hotspotBox({
      x: STORAGE_RACK_BOUNDS.x,
      y: STORAGE_RACK_BOUNDS.y,
      width: Math.round(STORAGE_RACK_BOUNDS.width * 0.5),
      height: Math.round(STORAGE_RACK_BOUNDS.height * 0.48),
    }),
  },
  {
    id: "achievements",
    label: "Achievements",
    // Right top: trophy
    box: hotspotBox({
      x: STORAGE_RACK_BOUNDS.x + Math.round(STORAGE_RACK_BOUNDS.width * 0.5),
      y: STORAGE_RACK_BOUNDS.y,
      width: Math.round(STORAGE_RACK_BOUNDS.width * 0.5),
      height: Math.round(STORAGE_RACK_BOUNDS.height * 0.48),
    }),
  },
  {
    id: "collection",
    label: "Collection",
    // Open clothes shelf + wide drawer
    box: hotspotBox({
      x: STORAGE_RACK_BOUNDS.x,
      y: STORAGE_RACK_BOUNDS.y + Math.round(STORAGE_RACK_BOUNDS.height * 0.45),
      width: STORAGE_RACK_BOUNDS.width,
      height: Math.round(STORAGE_RACK_BOUNDS.height * 0.55),
    }),
  },
];

/** Blackboard on the wall. */
export const ROOM_WALL_HOTSPOTS: readonly RoomWallHotspot[] = [
  {
    id: "blackboard",
    label: "Blackboard",
    tutorialTarget: "social",
    box: hotspotBox(BLACKBOARD_BOUNDS),
  },
];

/** Solid props: collision + draw-order occlusion (not carpet). */
export const ROOM_FURNITURE: readonly RoomFurniturePiece[] = [
  piece("loveseat", "loveseat.svg", LOVESEAT_BOUNDS, LOVESEAT_BLOCK_FROM, loveseatBlock()),
  piece("lamp", "lamp.svg", LAMP_BOUNDS),
  storageRackPiece(),
  blackboardPiece(),
  bookshelfPiece(),
  piece("plant", "plant.svg", PLANT_BOUNDS),
];

/** Walk obstacles — skip zero-size wall props (blackboard). */
export function furnitureWalkObstacles(pieces: readonly RoomFurniturePiece[] = ROOM_FURNITURE): RoomObstacle[] {
  return pieces
    .map((item) => item.block)
    .filter((block) => block.maxLeft > block.minLeft && block.maxTop > block.minTop);
}

export const ROOM_WALL_SRC = "/pet-assets/room/base/wall.svg";
export const ROOM_FLOOR_SRC = "/pet-assets/room/base/floor.svg";
export const ROOM_TRIM_SRC = "/pet-assets/room/base/trim.svg";
/** Purple rug — same stack as floor; never occludes pets; walkable. */
export const ROOM_CARPET_SRC = "/pet-assets/room/base/carpet.svg";

/** Obstacles used by wander (furniture footprints only; carpet excluded). */
export const ROOM_OBSTACLES: readonly RoomObstacle[] = furnitureWalkObstacles();

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
