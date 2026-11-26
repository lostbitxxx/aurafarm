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

export type RoomFurnitureId =
  | "sofa"
  | "armchair"
  | "loveseat"
  | "bookshelf"
  | "lamp"
  | "plant"
  | "storage-rack"
  | "blackboard";

export type RoomFurniturePiece = {
  id: RoomFurnitureId;
  /** Default (base) layer under /pet-assets/room/<item>/base.svg, or the console rack. */
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
  /** Hit area in the shared 600×300 SVG space (for SVG overlay targets). */
  bounds: RoomRectPx;
  /** Percent box derived from bounds (tests / legacy). */
  box: RoomObstacle;
};

/** Wall blackboard hotspot (Blackboard panel). */
export type RoomWallHotspotId = "blackboard";

export type RoomWallHotspot = {
  id: RoomWallHotspotId;
  label: string;
  /** Tutorial target id (kept as "social" for the desk tour). */
  tutorialTarget: "social";
  /** Hit area in the shared 600×300 SVG space (for SVG overlay targets). */
  bounds: RoomRectPx;
  /** Percent box derived from bounds (tests / legacy). */
  box: RoomObstacle;
};

export function pxToLeftPercent(x: number) {
  return (x / ROOM_VIEW_WIDTH) * 100;
}

export function pxToTopPercent(y: number) {
  return (y / ROOM_VIEW_HEIGHT) * 100;
}

/**
 * Fake-3D furniture base: lower half of the piece bounds.
 * Collision uses this whole band; Y-sort compares against the band's bottom edge.
 */
export const FURNITURE_BLOCK_FROM = 0.5;

/**
 * Footprint obstacle from a pixel bbox.
 * `blockedFromFraction` is where the no-walk zone starts down the bbox (0 = full height,
 * 0.5 = bottom half).
 */
export function footprintObstacle(
  bounds: RoomRectPx,
  blockedFromFraction = FURNITURE_BLOCK_FROM,
): RoomObstacle {
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
  return footprintObstacle(bounds, FURNITURE_BLOCK_FROM);
}

export function depthTopFromBounds(bounds: RoomRectPx) {
  return pxToTopPercent(bounds.y + bounds.height);
}

/** Four-seat sofa. Height includes the arms, which extend past the back cushion. */
export const SOFA_BOUNDS: RoomRectPx = { x: 33, y: 110, width: 147, height: 62 };
/** One-seat chair, between the lamp and the console. */
export const ARMCHAIR_BOUNDS: RoomRectPx = { x: 232, y: 132, width: 52, height: 52 };
/** Two-seat loveseat, on the floor in front of the console's right side. */
export const LOVESEAT_BOUNDS: RoomRectPx = { x: 360, y: 176, width: 108, height: 48 };
const BOOKSHELF_BOUNDS: RoomRectPx = { x: 471, y: 48, width: 75, height: 88 };
const LAMP_BOUNDS: RoomRectPx = { x: 183, y: 116, width: 42, height: 60 };
const PLANT_BOUNDS: RoomRectPx = { x: 509, y: 139, width: 35, height: 82 };
/** Between the lamp and the bookshelf, mid-back wall. Pixel art is 320×160 (2:1). */
const STORAGE_RACK_BOUNDS: RoomRectPx = { x: 292, y: 78, width: 130, height: 65 };
/** On the wall above and slightly left of the storage rack. */
const BLACKBOARD_BOUNDS: RoomRectPx = { x: 248, y: 22, width: 100, height: 48 };

/** @deprecated Sofa walk block is the shared lower-half base; sit is a separate drop. */
export const LOVESEAT_BLOCK_FROM = FURNITURE_BLOCK_FROM;

function piece(
  id: RoomFurnitureId,
  src: string,
  bounds: RoomRectPx,
  blockedFromFraction = FURNITURE_BLOCK_FROM,
  block: RoomObstacle = footprintObstacle(bounds, blockedFromFraction),
): RoomFurniturePiece {
  return {
    id,
    src,
    bounds,
    depthTop: depthTopFromBounds(bounds),
    block,
  };
}

/** Shelf sorts by its real bbox bottom (lower-half base), same as floor furniture. */
export const BOOKSHELF_DEPTH_TOP = depthTopFromBounds(BOOKSHELF_BOUNDS);

function bookshelfPiece(): RoomFurniturePiece {
  return {
    id: "bookshelf",
    src: "/pet-assets/room/shelf/base.svg",
    bounds: BOOKSHELF_BOUNDS,
    depthTop: BOOKSHELF_DEPTH_TOP,
    block: footprintObstacle(BOOKSHELF_BOUNDS, FURNITURE_BLOCK_FROM),
  };
}

/** Storage rack: lower-half collision + bbox-bottom depth (not a wall prop). */
export const STORAGE_RACK_DEPTH_TOP = depthTopFromBounds(STORAGE_RACK_BOUNDS);

function storageRackPiece(): RoomFurniturePiece {
  return {
    id: "storage-rack",
    src: "/pet-assets/room/furniture/storage-rack.svg",
    bounds: STORAGE_RACK_BOUNDS,
    depthTop: STORAGE_RACK_DEPTH_TOP,
    block: footprintObstacle(STORAGE_RACK_BOUNDS, FURNITURE_BLOCK_FROM),
  };
}

/**
 * Wall board: always behind pets and floor furniture (no walk collision).
 * Depth stays near 0 so roomDepthZ stays at the stack floor.
 */
export const BLACKBOARD_DEPTH_TOP = 0;

function blackboardPiece(): RoomFurniturePiece {
  return {
    id: "blackboard",
    src: "/pet-assets/room/board/base.svg",
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

function rackHotspot(id: RoomRackHotspotId, label: string, bounds: RoomRectPx): RoomRackHotspot {
  return { id, label, bounds, box: hotspotBox(bounds) };
}

/** Gramophone / trophy / clothes-shelf+drawer hit areas on the storage rack. */
export const ROOM_RACK_HOTSPOTS: readonly RoomRackHotspot[] = [
  // Left top: gramophone
  rackHotspot("song", "Song", {
    x: STORAGE_RACK_BOUNDS.x,
    y: STORAGE_RACK_BOUNDS.y,
    width: Math.round(STORAGE_RACK_BOUNDS.width * 0.5),
    height: Math.round(STORAGE_RACK_BOUNDS.height * 0.48),
  }),
  // Right top: trophy
  rackHotspot("achievements", "Achievements", {
    x: STORAGE_RACK_BOUNDS.x + Math.round(STORAGE_RACK_BOUNDS.width * 0.5),
    y: STORAGE_RACK_BOUNDS.y,
    width: Math.round(STORAGE_RACK_BOUNDS.width * 0.5),
    height: Math.round(STORAGE_RACK_BOUNDS.height * 0.48),
  }),
  // Open clothes shelf + wide drawer
  rackHotspot("collection", "Collection", {
    x: STORAGE_RACK_BOUNDS.x,
    y: STORAGE_RACK_BOUNDS.y + Math.round(STORAGE_RACK_BOUNDS.height * 0.45),
    width: STORAGE_RACK_BOUNDS.width,
    height: Math.round(STORAGE_RACK_BOUNDS.height * 0.55),
  }),
];

/** Pixel pet shelter in the bottom-left corner. Walkable; opens My Pets. */
export const WORMHOLE_BOUNDS: RoomRectPx = { x: 17, y: 234, width: 73, height: 47 };
export const WORMHOLE_SRC = "/pet-assets/room/wormhole/base.svg";

/** Blackboard on the wall. */
export const ROOM_WALL_HOTSPOTS: readonly RoomWallHotspot[] = [
  {
    id: "blackboard",
    label: "Blackboard",
    tutorialTarget: "social",
    bounds: BLACKBOARD_BOUNDS,
    box: hotspotBox(BLACKBOARD_BOUNDS),
  },
];

/** Solid props: collision + draw-order occlusion (not carpet). */
export const ROOM_FURNITURE: readonly RoomFurniturePiece[] = [
  piece("sofa", "/pet-assets/room/sofa/base.svg", SOFA_BOUNDS),
  piece("lamp", "/pet-assets/room/lamp/base.svg", LAMP_BOUNDS),
  storageRackPiece(),
  blackboardPiece(),
  bookshelfPiece(),
  piece("plant", "/pet-assets/room/plant/base.svg", PLANT_BOUNDS),
  piece("armchair", "/pet-assets/room/armchair/base.svg", ARMCHAIR_BOUNDS),
  piece("loveseat", "/pet-assets/room/loveseat/base.svg", LOVESEAT_BOUNDS),
];

/** Walk obstacles — skip zero-size wall props (blackboard). */
export function furnitureWalkObstacles(pieces: readonly RoomFurniturePiece[] = ROOM_FURNITURE): RoomObstacle[] {
  return pieces
    .map((item) => item.block)
    .filter((block) => block.maxLeft > block.minLeft && block.maxTop > block.minTop);
}

export const ROOM_WALL_SRC = "/pet-assets/room/wall/base.svg";
export const ROOM_FLOOR_SRC = "/pet-assets/room/floor/base.svg";
export const ROOM_TRIM_SRC = "/pet-assets/room/trim/base.svg";
/** Purple rug — same stack as floor; never occludes pets; walkable. */
export const ROOM_CARPET_SRC = "/pet-assets/room/carpet/base.svg";

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

/**
 * Starting wrap-centers in open floor corridors.
 * Standing lines (center + PET_STANDING_FROM_CENTER_PCT) must clear every lower-half block.
 */
export const ROOM_START_SPOTS = [
  { left: 34, top: 62 },
  { left: 44, top: 64 },
  { left: 56, top: 58 },
  { left: 48, top: 68 },
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

/**
 * Room pet sprite is 70/466 of room height (cqh). Art viewBox is 42×42; idle feet
 * paint ends at y=38 (4px empty under the toes). Floor pets use center transform, so
 * the standing line sits this far below `spot.top`.
 */
export const PET_SPRITE_HEIGHT_PCT = (70 / 466) * 100;
export const PET_FEET_BOTTOM_IN_VIEWBOX = 38 / 42;
export const PET_STANDING_FROM_CENTER_PCT =
  (PET_FEET_BOTTOM_IN_VIEWBOX - 0.5) * PET_SPRITE_HEIGHT_PCT;

/** Furniture/pet depth key after a vertical decor offset (percent). */
export function paintDepthTop(depthTop: number, offsetDy = 0) {
  const dy = Number.isFinite(offsetDy) ? offsetDy : 0;
  return depthTop + dy;
}

/**
 * Standing line in room `top%`.
 * - `floor`: wrap center + feet offset (idle / walk).
 * - `feet`: `top` is already the wrap bottom (sofa sit / crew seat anchor with desk legs).
 */
export function petStandingTop(top: number, mode: "floor" | "feet") {
  const safe = Number.isFinite(top) ? top : 0;
  return mode === "feet" ? safe : safe + PET_STANDING_FROM_CENTER_PCT;
}

export function wrapCenterFromStanding(standingTop: number) {
  return standingTop - PET_STANDING_FROM_CENTER_PCT;
}

/** True when a floor pet's standing line sits inside a furniture base band. */
export function standingHitsObstacle(
  spot: { left: number; top: number },
  obstacles: readonly RoomObstacle[] = ROOM_OBSTACLES,
  mode: "floor" | "feet" = "floor",
) {
  return spotHitsObstacle({ left: spot.left, top: petStandingTop(spot.top, mode) }, obstacles);
}

/** Ceiling for Y-sorted furniture / idle pets inside `.living-room`. */
export const ROOM_DEPTH_Z_MAX = 200;

/**
 * While dragging, paint above every depth-sorted layer (and the daily capsule).
 * Safe inside `.living-room { isolation: isolate }` — does not cover page dialogs.
 */
export const ROOM_DRAG_Z = ROOM_DEPTH_Z_MAX + 40;

/**
 * Name / Lv / Aurafarming labels sit above furniture, idle pets, and a dragged pet.
 */
export const ROOM_LABEL_Z = ROOM_DRAG_Z + 10;

/** z-index for Y-sort: larger top% draws in front. */
export function roomDepthZ(depthTop: number) {
  const safe = Number.isFinite(depthTop) ? depthTop : 0;
  return Math.max(1, Math.min(ROOM_DEPTH_Z_MAX, Math.round(safe * 2)));
}
