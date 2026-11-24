/**
 * Room decorating: which skins a player owns, which optional pieces are placed,
 * and how far movable pieces sit from their default spots.
 * Floor, trim, and wall stay fixed. Trim follows the wall skin in the picker.
 * Players own the base skin of every item; other skins are bought with coins.
 */

import {
  ARMCHAIR_BOUNDS,
  LOVESEAT_BOUNDS,
  ROOM_FLOOR_START_Y,
  ROOM_FURNITURE,
  ROOM_RACK_HOTSPOTS,
  ROOM_VIEW_HEIGHT,
  ROOM_VIEW_WIDTH,
  SOFA_BOUNDS,
  WORMHOLE_BOUNDS,
  pxToLeftPercent,
  pxToTopPercent,
  type RoomFurnitureId,
  type RoomFurniturePiece,
  type RoomObstacle,
  type RoomRectPx,
} from "@/lib/living-room-layout";

/** Session edit Undo/Redo depth (cleared on Save / leave edit). */
export const DECOR_HISTORY_LIMIT = 5;

/** How close (percent of room width) to horizontal center before a fast drag snaps. */
export const DECOR_CENTER_SNAP_RADIUS_PCT = 2.5;

/** Wider band to *stay* snapped so the magnet does not flicker off immediately. */
export const DECOR_CENTER_SNAP_RELEASE_RADIUS_PCT = 7;

/** Pointer speed (px/ms) required to engage horizontal center snap. Slow crawls stay free. */
export const DECOR_CENTER_SNAP_MIN_SPEED_PX_PER_MS = 0.35;

/** Small top margin so wall pieces stay below the ceiling trim. */
const WALL_CEILING_MARGIN_PCT = 1;

const RACK_SONG_BOUNDS = ROOM_RACK_HOTSPOTS.find((spot) => spot.id === "song")!.bounds;
const RACK_TROPHY_BOUNDS = ROOM_RACK_HOTSPOTS.find((spot) => spot.id === "achievements")!.bounds;
/** Console sheet used in the living room for music + trophy previews. */
const STORAGE_RACK_SRC = "/pet-assets/room/furniture/storage-rack.svg";

export type RoomDecorCategoryId =
  | "floor"
  | "trim"
  | "wall"
  | "carpet"
  | "lamp"
  | "board"
  | "music"
  | "trophy"
  | "shelf"
  | "armchair"
  | "loveseat"
  | "sofa"
  | "plant"
  | "shelter";

export type DecorMoverId = RoomFurnitureId | "carpet" | "shelter";

export type RoomSkin = {
  id: string;
  name: string;
  description: string;
};

export type RoomDecorCategory = {
  id: RoomDecorCategoryId;
  label: string;
  folder: string;
  /** Optional pieces can be added and removed. Must-haves stay in the room. */
  optional: boolean;
  /** Piece that slides in edit mode. Music and trophy share the console. */
  mover: DecorMoverId | null;
  /** Crop inside the 600×300 layer, when the skin is a full-room sheet. */
  crop: RoomRectPx | null;
  skins: readonly RoomSkin[];
  /** Hidden from the category list when its skins are shown under another category. */
  sidebar?: boolean;
  /** Drag-handle name when it differs from the category label. */
  handle?: string;
};

export type DecorOption = {
  key: string;
  name: string;
  description: string;
  categoryId: RoomDecorCategoryId;
  skinId: string;
  crop: RoomRectPx | null;
};

export type RoomDecorOffset = { dx: number; dy: number };

export type RoomDecor = {
  skins: Record<RoomDecorCategoryId, string>;
  placed: Record<RoomDecorCategoryId, boolean>;
  offsets: Record<DecorMoverId, RoomDecorOffset>;
};

/** Visible rug inside carpet/base.svg, used as the drag handle. */
export const CARPET_DRAG_BOUNDS: RoomRectPx = { x: 230, y: 190, width: 222, height: 77 };

const THEME_SKINS: readonly RoomSkin[] = [
  { id: "base", name: "Base", description: "The starter look that comes with your room." },
  { id: "greenhouse", name: "Greenhouse", description: "Leafy greens and soft garden light." },
  { id: "orbital", name: "Orbital", description: "A quiet lounge in orbit." },
  { id: "leather", name: "Leather", description: "Warm study leather and brass." },
];

function themeSkins(noun: string): RoomSkin[] {
  return THEME_SKINS.map((skin) => ({
    id: skin.id,
    name: skin.id === "base" ? noun : `${skin.name} ${noun}`,
    description: skin.description,
  }));
}

function seatLine(capacity: number) {
  return capacity === 1 ? "Seats 1 pet." : `Seats ${capacity} pets.`;
}

function seatSkins(noun: string, capacity: number, skins: readonly RoomSkin[] = THEME_SKINS): RoomSkin[] {
  return skins.map((skin) => ({
    id: skin.id,
    name: skin.id === "base" ? noun : `${skin.name} ${noun}`,
    description: `${skin.description} ${seatLine(capacity)}`,
  }));
}

export const ROOM_DECOR_CATEGORIES: readonly RoomDecorCategory[] = [
  {
    id: "floor",
    label: "Floor",
    folder: "floor",
    optional: false,
    mover: null,
    crop: null,
    skins: themeSkins("Floor"),
  },
  {
    id: "trim",
    label: "Trim",
    folder: "trim",
    optional: false,
    mover: null,
    crop: null,
    /** Picked with Wall — same theme id is applied to both layers. */
    sidebar: false,
    skins: themeSkins("Trim"),
  },
  {
    id: "wall",
    label: "Wall",
    folder: "wall",
    optional: false,
    mover: null,
    crop: null,
    skins: themeSkins("Wall"),
  },
  {
    id: "carpet",
    label: "Carpet",
    folder: "carpet",
    optional: true,
    mover: "carpet",
    crop: CARPET_DRAG_BOUNDS,
    skins: themeSkins("Carpet"),
  },
  {
    id: "lamp",
    label: "Lamp",
    folder: "lamp",
    optional: true,
    mover: "lamp",
    crop: { x: 183, y: 116, width: 42, height: 60 },
    skins: [
      { id: "base", name: "Cozy Table Lamp", description: "A small lamp for late study nights." },
      { id: "greenhouse", name: "Greenhouse Lamp", description: "A lamp grown in with the plants." },
      { id: "orbital", name: "Orbital Lamp", description: "A lamp from the lounge in orbit." },
      { id: "leather", name: "Leather Lamp", description: "A lamp with a warm study shade." },
    ],
  },
  {
    id: "board",
    label: "Board",
    folder: "board",
    optional: false,
    mover: "blackboard",
    crop: { x: 248, y: 22, width: 100, height: 48 },
    /** Hidden until alternate board skins exist. */
    sidebar: false,
    skins: [{ id: "base", name: "Blackboard", description: "Opens Social. It stays on the wall." }],
  },
  {
    id: "music",
    label: "Music",
    folder: "music",
    optional: false,
    mover: "storage-rack",
    /** Crop of the gramophone on the shared console sheet. */
    crop: RACK_SONG_BOUNDS,
    /** Hidden until alternate music skins exist. */
    sidebar: false,
    skins: [
      {
        id: "base",
        name: "Gramophone",
        description: "Opens Songs. It moves with the trophy and the collection drawer.",
      },
    ],
  },
  {
    id: "trophy",
    label: "Trophy",
    folder: "trophy",
    optional: false,
    mover: "storage-rack",
    /** Crop of the trophy on the shared console sheet (not the placeholder trophy/base.svg). */
    crop: RACK_TROPHY_BOUNDS,
    /** Hidden until alternate trophy skins exist. */
    sidebar: false,
    skins: [
      {
        id: "base",
        name: "Trophy",
        description: "Opens Achievements. It moves with the gramophone and the collection drawer.",
      },
    ],
  },
  {
    id: "shelf",
    label: "Shelf",
    folder: "shelf",
    optional: false,
    mover: "bookshelf",
    crop: { x: 471, y: 48, width: 75, height: 88 },
    skins: themeSkins("Shelf"),
  },
  {
    id: "armchair",
    label: "Armchair",
    folder: "armchair",
    optional: true,
    mover: "armchair",
    crop: ARMCHAIR_BOUNDS,
    sidebar: false,
    skins: seatSkins("Armchair", 1, [
      { id: "base", name: "Armchair", description: "The starter chair that comes with your room." },
    ]),
  },
  {
    id: "loveseat",
    label: "Loveseat",
    folder: "loveseat",
    optional: true,
    mover: "loveseat",
    crop: LOVESEAT_BOUNDS,
    sidebar: false,
    skins: seatSkins("Loveseat", 2, [
      { id: "base", name: "Loveseat", description: "The starter loveseat that comes with your room." },
    ]),
  },
  {
    id: "sofa",
    label: "Sofa",
    handle: "Couch",
    folder: "sofa",
    optional: true,
    mover: "sofa",
    crop: SOFA_BOUNDS,
    skins: seatSkins("Couch", 3),
  },
  {
    id: "plant",
    label: "Plant",
    folder: "plant",
    optional: true,
    mover: "plant",
    crop: { x: 509, y: 139, width: 35, height: 82 },
    skins: [
      { id: "base", name: "Sprout", description: "The little plant that comes with the room." },
      { id: "snake", name: "Snake Plant", description: "A tall snake plant." },
      { id: "monstera", name: "Monstera", description: "A broad monstera." },
      { id: "pothos", name: "Pothos", description: "A trailing pothos." },
    ],
  },
  {
    id: "shelter",
    label: "Adopt",
    folder: "wormhole",
    optional: false,
    mover: "shelter",
    crop: WORMHOLE_BOUNDS,
    /** Hidden from the decorate list. It only slides in edit mode. */
    sidebar: false,
    skins: [{ id: "base", name: "Adopt", description: "Opens My Pets. Drag it while editing the room." }],
  },
];

const CATEGORY_BY_ID = new Map(ROOM_DECOR_CATEGORIES.map((category) => [category.id, category]));

const PIECE_CATEGORY: Partial<Record<RoomFurnitureId, RoomDecorCategoryId>> = {
  sofa: "sofa",
  armchair: "armchair",
  loveseat: "loveseat",
  bookshelf: "shelf",
  lamp: "lamp",
  plant: "plant",
  blackboard: "board",
};

const MOVER_IDS: readonly DecorMoverId[] = [
  "carpet",
  "lamp",
  "sofa",
  "armchair",
  "loveseat",
  "plant",
  "blackboard",
  "storage-rack",
  "bookshelf",
  "shelter",
];

export function roomDecorCategory(id: RoomDecorCategoryId) {
  const category = CATEGORY_BY_ID.get(id);
  if (!category) throw new Error(`Unknown room category ${id}`);
  return category;
}

const SEAT_CATEGORY_IDS: readonly RoomDecorCategoryId[] = ["armchair", "loveseat", "sofa"];

function optionsFor(category: RoomDecorCategory): DecorOption[] {
  return category.skins.map((skin) => ({
    key: `${category.id}:${skin.id}`,
    name: skin.name,
    description: skin.description,
    categoryId: category.id,
    skinId: skin.id,
    crop: category.crop,
  }));
}

/** Skins shown for a category. Sofa lists the armchair, loveseat, and couch together. */
export function decorOptions(categoryId: RoomDecorCategoryId): readonly DecorOption[] {
  if (categoryId === "sofa") {
    return SEAT_CATEGORY_IDS.flatMap((id) => optionsFor(roomDecorCategory(id)));
  }
  return optionsFor(roomDecorCategory(categoryId));
}

export function seatGroupPlaced(decor: RoomDecor) {
  return SEAT_CATEGORY_IDS.some((id) => isRoomItemPlaced(decor, id));
}

export function setSeatGroupPlaced(decor: RoomDecor, placed: boolean): RoomDecor {
  const next = cloneRoomDecor(decor);
  if (placed) {
    next.placed.sofa = true;
    return next;
  }
  for (const id of SEAT_CATEGORY_IDS) next.placed[id] = false;
  return next;
}

/** Prices for purchasable skins. Must match room_skin_catalog in migration 0049. */
export const ROOM_SKIN_PRICES: Readonly<Record<string, number>> = {
  "plant:snake": 30,
  "plant:monstera": 30,
  "plant:pothos": 30,
  "lamp:greenhouse": 60,
  "lamp:orbital": 60,
  "lamp:leather": 60,
  "carpet:greenhouse": 60,
  "carpet:orbital": 60,
  "carpet:leather": 60,
  "shelf:greenhouse": 90,
  "shelf:orbital": 90,
  "shelf:leather": 90,
  "sofa:greenhouse": 90,
  "sofa:orbital": 90,
  "sofa:leather": 90,
  "floor:greenhouse": 120,
  "floor:orbital": 120,
  "floor:leather": 120,
  "wall:greenhouse": 120,
  "wall:orbital": 120,
  "wall:leather": 120,
};

export function roomSkinKey(categoryId: RoomDecorCategoryId, skinId: string) {
  return `${categoryId}:${skinId}`;
}

export function roomSkinPrice(categoryId: RoomDecorCategoryId, skinId: string) {
  if (skinId === "base") return 0;
  return ROOM_SKIN_PRICES[roomSkinKey(categoryId, skinId)] ?? null;
}

export function ownedRoomSkinKeys(
  rows: readonly { category_id: string; skin_id: string }[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (typeof row.category_id !== "string" || typeof row.skin_id !== "string") continue;
    keys.add(roomSkinKey(row.category_id as RoomDecorCategoryId, row.skin_id));
  }
  return keys;
}

/** Base is always owned. Trim follows an owned wall of the same skin id. */
export function skinOwned(
  categoryId: RoomDecorCategoryId,
  skinId: string,
  owned: ReadonlySet<string> = new Set(),
) {
  if (skinId === "base") return true;
  if (owned.has(roomSkinKey(categoryId, skinId))) return true;
  if (categoryId === "trim" && owned.has(roomSkinKey("wall", skinId))) return true;
  return false;
}

export function roomSkinSrc(categoryId: RoomDecorCategoryId, skinId: string) {
  // Music and trophy paint from the console in the room — preview the same sheet.
  if (categoryId === "music" || categoryId === "trophy") return STORAGE_RACK_SRC;
  const category = roomDecorCategory(categoryId);
  const known = category.skins.some((skin) => skin.id === skinId);
  const id = known ? skinId : "base";
  return `/pet-assets/room/${category.folder}/${id}.svg`;
}

export function roomBackgroundSrc(categoryId: RoomDecorCategoryId, skinId: string | undefined, baseSrc: string) {
  if (!skinId || skinId === "base") return baseSrc;
  return roomSkinSrc(categoryId, skinId);
}

export function roomFurnitureSrc(piece: RoomFurniturePiece, decor: RoomDecor) {
  const categoryId = PIECE_CATEGORY[piece.id];
  if (!categoryId) return piece.src;
  return roomBackgroundSrc(categoryId, decor.skins[categoryId], piece.src);
}

export function isRoomItemPlaced(decor: RoomDecor, categoryId: RoomDecorCategoryId) {
  const category = roomDecorCategory(categoryId);
  if (!category.optional) return true;
  return decor.placed[categoryId] !== false;
}

export function isFurniturePlaced(decor: RoomDecor, pieceId: RoomFurnitureId) {
  const categoryId = PIECE_CATEGORY[pieceId];
  if (!categoryId) return true;
  return isRoomItemPlaced(decor, categoryId);
}

function zeroOffsets(): Record<DecorMoverId, RoomDecorOffset> {
  return {
    carpet: { dx: 0, dy: 0 },
    lamp: { dx: 0, dy: 0 },
    sofa: { dx: 0, dy: 0 },
    armchair: { dx: 0, dy: 0 },
    loveseat: { dx: 0, dy: 0 },
    plant: { dx: 0, dy: 0 },
    blackboard: { dx: 0, dy: 0 },
    "storage-rack": { dx: 0, dy: 0 },
    bookshelf: { dx: 0, dy: 0 },
    shelter: { dx: 0, dy: 0 },
  };
}

function clampedZeroOffsets(): Record<DecorMoverId, RoomDecorOffset> {
  const offsets = zeroOffsets();
  for (const id of MOVER_IDS) {
    offsets[id] = clampMoverOffset(id, moverBounds(id), 0, 0);
  }
  return offsets;
}

export function defaultRoomDecor(): RoomDecor {
  const skins = {} as Record<RoomDecorCategoryId, string>;
  const placed = {} as Record<RoomDecorCategoryId, boolean>;
  for (const category of ROOM_DECOR_CATEGORIES) {
    skins[category.id] = "base";
    placed[category.id] = category.id !== "armchair" && category.id !== "loveseat";
  }
  return { skins, placed, offsets: clampedZeroOffsets() };
}

export function cloneRoomDecor(decor: RoomDecor): RoomDecor {
  const offsets = zeroOffsets();
  for (const id of MOVER_IDS) {
    const offset = decor.offsets[id] ?? { dx: 0, dy: 0 };
    offsets[id] = { dx: offset.dx, dy: offset.dy };
  }
  return {
    skins: { ...decor.skins },
    placed: { ...decor.placed },
    offsets,
  };
}

export function moverBounds(id: DecorMoverId): RoomRectPx {
  if (id === "carpet") return CARPET_DRAG_BOUNDS;
  if (id === "shelter") return WORMHOLE_BOUNDS;
  const piece = ROOM_FURNITURE.find((item) => item.id === id);
  return piece?.bounds ?? { x: 0, y: 0, width: 60, height: 60 };
}

/** Visual wall/floor seam in percent of room height (pets walk on/below this). */
export function roomFloorSeamTopPercent() {
  return pxToTopPercent(ROOM_FLOOR_START_Y);
}

/**
 * Floor movers may not ride higher than this (seam + half the storage-rack height),
 * so leaning pieces sit lower than the painted wall line.
 */
export function roomFloorPlacementTopPercent() {
  const rack = ROOM_FURNITURE.find((item) => item.id === "storage-rack");
  const halfRack = (rack?.bounds.height ?? 65) / 2;
  return pxToTopPercent(ROOM_FLOOR_START_Y + halfRack);
}

/** Keep a mover fully inside the room frame (no hanging off the edges). */
export function clampRoomOffset(bounds: RoomRectPx, dx: number, dy: number): RoomDecorOffset {
  const safeDx = Number.isFinite(dx) ? dx : 0;
  const safeDy = Number.isFinite(dy) ? dy : 0;
  const left0 = pxToLeftPercent(bounds.x);
  const top0 = pxToTopPercent(bounds.y);
  const width = pxToLeftPercent(bounds.width);
  const height = pxToTopPercent(bounds.height);
  const left = Math.min(100 - width, Math.max(0, left0 + safeDx));
  const top = Math.min(100 - height, Math.max(0, top0 + safeDy));
  return { dx: left - left0, dy: top - top0 };
}

/**
 * In-frame clamp plus wall/floor bands:
 * - blackboard: whole piece stays in the wall band (bottom ≤ visual floor seam).
 * - carpet: whole piece stays strictly in the floor area (top ≥ visual floor seam).
 * - other furniture: feet/bottom stay on/below the lowered floor placement line; top may lean onto the wall.
 */
export function clampMoverOffset(
  id: DecorMoverId,
  bounds: RoomRectPx,
  dx: number,
  dy: number,
): RoomDecorOffset {
  const framed = clampRoomOffset(bounds, dx, dy);
  const top0 = pxToTopPercent(bounds.y);
  const height = pxToTopPercent(bounds.height);
  let top = top0 + framed.dy;
  const wallFloorSeam = roomFloorSeamTopPercent();
  const floorPlacement = roomFloorPlacementTopPercent();
  if (id === "blackboard") {
    const maxTop = wallFloorSeam - height;
    const minTop = WALL_CEILING_MARGIN_PCT;
    top = Math.min(maxTop, Math.max(minTop, top));
  } else if (id === "carpet") {
    // Rug stays fully on the floor — no wall lean.
    top = Math.min(100 - height, Math.max(wallFloorSeam, top));
  } else if (top + height < floorPlacement) {
    // Feet stay on the floor side of the placement line (lean upward is fine).
    top = floorPlacement - height;
  }
  // Keep fully in frame after band adjustments.
  top = Math.min(100 - height, Math.max(0, top));
  return { dx: framed.dx, dy: top - top0 };
}

export function setRoomItemPlaced(decor: RoomDecor, categoryId: RoomDecorCategoryId, placed: boolean): RoomDecor {
  const category = roomDecorCategory(categoryId);
  if (!category.optional) return decor;
  return { ...cloneRoomDecor(decor), placed: { ...decor.placed, [categoryId]: placed } };
}

export function equipRoomSkin(
  decor: RoomDecor,
  categoryId: RoomDecorCategoryId,
  skinId: string,
  owned: ReadonlySet<string> = new Set(),
): RoomDecor {
  const category = roomDecorCategory(categoryId);
  const skin = category.skins.find((item) => item.id === skinId);
  if (!skin || !skinOwned(categoryId, skin.id, owned)) return decor;
  const next = cloneRoomDecor(decor);
  next.skins[categoryId] = skin.id;
  // Wall and trim share theme ids; keep both layers on the same look.
  if (categoryId === "wall" || categoryId === "trim") {
    next.skins.wall = skin.id;
    next.skins.trim = skin.id;
  }
  if (category.optional) next.placed[categoryId] = true;
  // Only one seat piece in the room at a time.
  if (SEAT_CATEGORY_IDS.includes(categoryId)) {
    for (const id of SEAT_CATEGORY_IDS) {
      next.placed[id] = id === categoryId;
    }
  }
  return next;
}

export function moveRoomItem(decor: RoomDecor, id: DecorMoverId, dx: number, dy: number): RoomDecor {
  const next = cloneRoomDecor(decor);
  next.offsets[id] = clampMoverOffset(id, moverBounds(id), dx, dy);
  return next;
}

/** `dx` that centers a mover left–right in the room (vertical position unchanged). */
export function horizontalCenterDx(bounds: RoomRectPx) {
  const left0 = pxToLeftPercent(bounds.x);
  const width = pxToLeftPercent(bounds.width);
  return (100 - width) / 2 - left0;
}

/**
 * Snap only on the horizontal axis. Fast near-center grabs; once grabbed, stays
 * snapped until the free pointer leaves a wider release band (hysteresis).
 * Pass the *unsnapped* offset so release distance is measured against the cursor.
 */
export function withHorizontalCenterSnap(
  id: DecorMoverId,
  offset: RoomDecorOffset,
  pointerSpeedPxPerMs: number,
  wasSnapped = false,
): { offset: RoomDecorOffset; snapped: boolean } {
  const bounds = moverBounds(id);
  const targetDx = horizontalCenterDx(bounds);
  const speed = Number.isFinite(pointerSpeedPxPerMs) ? Math.max(0, pointerSpeedPxPerMs) : 0;
  const distance = Math.abs(offset.dx - targetDx);
  const enter =
    !wasSnapped &&
    speed >= DECOR_CENTER_SNAP_MIN_SPEED_PX_PER_MS &&
    distance <= DECOR_CENTER_SNAP_RADIUS_PCT;
  const hold = wasSnapped && distance <= DECOR_CENTER_SNAP_RELEASE_RADIUS_PCT;
  if (enter || hold) {
    return { offset: clampMoverOffset(id, bounds, targetDx, offset.dy), snapped: true };
  }
  return { offset, snapped: false };
}

export type DecorHistory = {
  past: RoomDecor[];
  future: RoomDecor[];
};

export function emptyDecorHistory(): DecorHistory {
  return { past: [], future: [] };
}

export function roomDecorEqual(a: RoomDecor, b: RoomDecor) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Push `previous` before applying a new draft. Caps at DECOR_HISTORY_LIMIT; clears redo. */
export function pushDecorHistory(history: DecorHistory, previous: RoomDecor): DecorHistory {
  return {
    past: [...history.past, cloneRoomDecor(previous)].slice(-DECOR_HISTORY_LIMIT),
    future: [],
  };
}

export function undoDecor(
  history: DecorHistory,
  current: RoomDecor,
): { history: DecorHistory; decor: RoomDecor } | null {
  if (history.past.length === 0) return null;
  const past = history.past.slice(0, -1);
  const decor = history.past[history.past.length - 1]!;
  return {
    decor: cloneRoomDecor(decor),
    history: {
      past,
      future: [cloneRoomDecor(current), ...history.future].slice(0, DECOR_HISTORY_LIMIT),
    },
  };
}

export function redoDecor(
  history: DecorHistory,
  current: RoomDecor,
): { history: DecorHistory; decor: RoomDecor } | null {
  if (history.future.length === 0) return null;
  const [decor, ...future] = history.future;
  return {
    decor: cloneRoomDecor(decor!),
    history: {
      past: [...history.past, cloneRoomDecor(current)].slice(-DECOR_HISTORY_LIMIT),
      future,
    },
  };
}

/** Map a viewBox rectangle onto a room that paints layers with object-fit: contain. */
export function coverBox(
  bounds: RoomRectPx,
  roomWidth: number,
  roomHeight: number,
  offset: RoomDecorOffset = { dx: 0, dy: 0 },
) {
  const width = Math.max(roomWidth, 1);
  const height = Math.max(roomHeight, 1);
  const scale = Math.min(width / ROOM_VIEW_WIDTH, height / ROOM_VIEW_HEIGHT);
  const originX = (width - ROOM_VIEW_WIDTH * scale) / 2;
  const originY = (height - ROOM_VIEW_HEIGHT * scale) / 2;
  return {
    left: originX + bounds.x * scale + (offset.dx / 100) * width,
    top: originY + bounds.y * scale + (offset.dy / 100) * height,
    width: bounds.width * scale,
    height: bounds.height * scale,
  };
}

export function offsetTransform(decor: RoomDecor, id: DecorMoverId) {
  const offset = decor.offsets[id];
  if (!offset || (offset.dx === 0 && offset.dy === 0)) return undefined;
  return `translate(${offset.dx}%, ${offset.dy}%)`;
}

export function decorObstacles(decor: RoomDecor): RoomObstacle[] {
  return ROOM_FURNITURE.flatMap((piece) => {
    if (!isFurniturePlaced(decor, piece.id)) return [];
    const block = piece.block;
    if (!(block.maxLeft > block.minLeft && block.maxTop > block.minTop)) return [];
    const offset = decor.offsets[piece.id] ?? { dx: 0, dy: 0 };
    return [
      {
        minLeft: block.minLeft + offset.dx,
        maxLeft: block.maxLeft + offset.dx,
        minTop: block.minTop + offset.dy,
        maxTop: block.maxTop + offset.dy,
      },
    ];
  });
}

export function parseRoomDecor(
  raw: string | null,
  owned: ReadonlySet<string> = new Set(),
): RoomDecor {
  const base = defaultRoomDecor();
  if (!raw) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!parsed || typeof parsed !== "object") return base;
  const record = parsed as Partial<RoomDecor>;
  const next = defaultRoomDecor();
  for (const category of ROOM_DECOR_CATEGORIES) {
    const skinId = record.skins?.[category.id];
    if (
      typeof skinId === "string" &&
      category.skins.some((skin) => skin.id === skinId) &&
      skinOwned(category.id, skinId, owned)
    ) {
      next.skins[category.id] = skinId;
    }
    if (category.optional) {
      const placed = record.placed?.[category.id];
      if (typeof placed === "boolean") next.placed[category.id] = placed;
    }
  }
  const savedOffsets = record.offsets as Partial<Record<string, RoomDecorOffset>> | undefined;
  // Older rooms stored the four-seat sofa offset under "loveseat".
  const legacySofa = savedOffsets?.sofa == null && savedOffsets?.loveseat != null;
  for (const id of MOVER_IDS) {
    const offset =
      id === "sofa" && legacySofa
        ? savedOffsets?.loveseat
        : id === "loveseat" && legacySofa
          ? undefined
          : savedOffsets?.[id];
    const dx = offset && typeof offset.dx === "number" ? offset.dx : 0;
    const dy = offset && typeof offset.dy === "number" ? offset.dy : 0;
    next.offsets[id] = clampMoverOffset(id, moverBounds(id), dx, dy);
  }
  return next;
}

function storageKey(userId: string) {
  return `aurafarm.room-decor.${userId}`;
}

export function readRoomDecor(
  userId: string,
  owned: ReadonlySet<string> = new Set(),
): RoomDecor {
  if (typeof window === "undefined") return defaultRoomDecor();
  try {
    return parseRoomDecor(window.localStorage.getItem(storageKey(userId)), owned);
  } catch {
    return defaultRoomDecor();
  }
}

export function writeRoomDecor(userId: string, decor: RoomDecor) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(decor));
}

export function decorHandles(decor: RoomDecor): { id: DecorMoverId; label: string }[] {
  const seen = new Set<DecorMoverId>();
  const handles: { id: DecorMoverId; label: string }[] = [];
  for (const category of ROOM_DECOR_CATEGORIES) {
    if (!category.mover || seen.has(category.mover)) continue;
    if (!isRoomItemPlaced(decor, category.id)) continue;
    seen.add(category.mover);
    const label =
      category.mover === "storage-rack"
        ? "Music, trophy, and collection drawer"
        : (category.handle ?? category.label);
    handles.push({ id: category.mover, label });
  }
  return handles;
}
