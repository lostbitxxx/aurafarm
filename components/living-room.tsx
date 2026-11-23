"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import {
  BLACKBOARD_DEPTH_TOP,
  ROOM_CARPET_SRC,
  ROOM_DRAG_Z,
  ROOM_FLOOR_SRC,
  ROOM_FURNITURE,
  ROOM_OBSTACLES,
  ROOM_RACK_HOTSPOTS,
  ROOM_TRIM_SRC,
  ROOM_VIEW_HEIGHT,
  ROOM_VIEW_WIDTH,
  ROOM_WALL_HOTSPOTS,
  ROOM_WALL_SRC,
  STORAGE_RACK_DEPTH_TOP,
  roomDepthZ,
  type RoomObstacle,
  type RoomRackHotspotId,
} from "@/lib/living-room-layout";
import {
  cloneRoomDecor,
  coverBox,
  decorHandles,
  decorObstacles,
  defaultRoomDecor,
  isFurniturePlaced,
  isRoomItemPlaced,
  moverBounds,
  moveRoomItem,
  offsetTransform,
  ownedRoomSkinKeys,
  readRoomDecor,
  roomBackgroundSrc,
  roomFurnitureSrc,
  writeRoomDecor,
  type DecorMoverId,
  type RoomDecor,
} from "@/lib/room-decor";
import {
  DRAG_STRUGGLE_AFTER_MS,
  facingFromDirection,
  dragPastThreshold,
  PETTING_HOLD_MS,
  pickWalkDirection,
  pointerPercentInRoom,
  randomIdleMs,
  randomWalkMs,
  resolveWanderSpot,
  sessionOrRandomWanderSpot,
  spotFromForeheadPointer,
  stepWanderSpot,
  writeSessionWanderSpot,
  type WanderDir,
  type WanderSpot,
} from "@/lib/living-room-wander";
import { PIXEL_HEART_SRC } from "@/lib/pet-assets";
import {
  dropOnSeat,
  liftSeat,
  readRoomSeats,
  reconcileSeats,
  seatAnchor,
  seatPaintZ,
  seatsEqual,
  writeRoomSeats,
  type SeatMap,
} from "@/lib/room-seats";
import { petDisplayName, type PetCard } from "@/lib/pets";
import { experienceProgress } from "@/lib/study";
import { DailyProgressCylinder } from "./daily-progress-cylinder";
import { RoomDecorateDialog } from "./room-decorate-dialog";
import { PixelPetArt, usePetting, useWalkPose } from "./pixel-pet";

type Mode = "idle" | "walking" | "petting" | "dragging";

function RoomPet({
  pet,
  paused,
  showPetNames,
  onOpen,
  obstaclesRef,
  seatedSpot,
  seatZ,
  onTrySit,
  onLiftSeat,
}: {
  pet: PetCard;
  paused: boolean;
  showPetNames: boolean;
  onOpen: (petId: string) => void;
  obstaclesRef: RefObject<readonly RoomObstacle[]>;
  seatedSpot: WanderSpot | null;
  seatZ: number | null;
  onTrySit: (spot: WanderSpot) => WanderSpot | null;
  onLiftSeat: () => void;
}) {
  const displayName = petDisplayName(pet);
  const progress = experienceProgress(pet.xp);
  const [position, setPosition] = useState(() => sessionOrRandomWanderSpot(pet.id));
  const [mode, setMode] = useState<Mode>("idle");
  const [faceLeft, setFaceLeft] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; drift: number }[]>([]);
  const heartIdRef = useRef(0);
  const [struggling, setStruggling] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<Mode>("idle");
  const positionRef = useRef(position);

  function commitSpot(next: WanderSpot) {
    positionRef.current = next;
    setPosition(next);
    writeSessionWanderSpot(pet.id, next);
  }
  const dirRef = useRef<WanderDir>({ x: 1, y: 0 });
  const faceLeftRef = useRef(false);
  const phaseUntilRef = useRef(0);
  const pettingTimerRef = useRef(0);
  const struggleTimerRef = useRef(0);
  const reducedRef = useRef(false);
  const pausedRef = useRef(paused);
  const sittingRef = useRef(seatedSpot !== null);
  const trySitRef = useRef(onTrySit);
  const liftSeatRef = useRef(onLiftSeat);
  trySitRef.current = onTrySit;
  liftSeatRef.current = onLiftSeat;
  const pressRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    suppressClick: boolean;
  } | null>(null);

  const walking = mode === "walking";
  const dragging = mode === "dragging";
  const walkPose = useWalkPose(walking);
  // Petting keeps blush; long drag switches to >< struggle eyes.
  // Idle/waiting always select idle explicitly from movement state (never a leftover walk frame).
  const pose =
    mode === "petting" ? "blush" : struggling ? "struggle" : walking ? walkPose : "idle";

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    faceLeftRef.current = faceLeft;
  }, [faceLeft]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const seatLeft = seatedSpot?.left ?? null;
  const seatTop = seatedSpot?.top ?? null;
  useEffect(() => {
    if (seatLeft == null || seatTop == null) {
      if (modeRef.current === "dragging") return;
      sittingRef.current = false;
      return;
    }
    sittingRef.current = true;
    if (modeRef.current !== "dragging") commitSpot({ left: seatLeft, top: seatTop });
    // commitSpot is recreated per render and only needs the latest pet id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatLeft, seatTop]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = media.matches;
    const onChange = () => {
      reducedRef.current = media.matches;
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // Hard unstick on mount (covers pets left in an expanded sofa footprint).
    // A pet already seated stays on the cushion; the seat effect owns that spot.
    if (!sittingRef.current) {
      commitSpot(resolveWanderSpot(positionRef.current, undefined, obstaclesRef.current));
    }

    let frame = 0;
    let last = performance.now();
    phaseUntilRef.current = last + randomIdleMs();
    modeRef.current = "idle";

    const enterIdle = (now: number) => {
      if (modeRef.current !== "idle") {
        modeRef.current = "idle";
        setMode("idle");
      }
      phaseUntilRef.current = now + randomIdleMs();
    };

    const enterWalk = (now: number) => {
      if (reducedRef.current || pausedRef.current) {
        enterIdle(now);
        return;
      }
      dirRef.current = pickWalkDirection();
      const nextFace = facingFromDirection(dirRef.current, faceLeftRef.current);
      if (nextFace !== faceLeftRef.current) {
        faceLeftRef.current = nextFace;
        setFaceLeft(nextFace);
      }
      modeRef.current = "walking";
      setMode("walking");
      phaseUntilRef.current = now + randomWalkMs();
    };

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const rawDt = (now - last) / 1000;
      last = now;
      const current = modeRef.current;

      if (current === "petting" || current === "dragging") return;

      if (sittingRef.current) {
        if (current === "walking") enterIdle(now);
        return;
      }

      // Unstick pets trapped in a no-go zone (e.g. sofa footprint grew after they sat there).
      const freed = resolveWanderSpot(positionRef.current, undefined, obstaclesRef.current);
      if (freed.left !== positionRef.current.left || freed.top !== positionRef.current.top) {
        commitSpot(freed);
      }

      if (pausedRef.current || reducedRef.current) {
        if (current === "walking") enterIdle(now);
        return;
      }

      if (current === "idle") {
        if (now >= phaseUntilRef.current) enterWalk(now);
        return;
      }

      if (now >= phaseUntilRef.current) {
        enterIdle(now);
        return;
      }

      const room = wrapRef.current?.offsetParent as HTMLElement | null;
      const width = room?.clientWidth ?? 640;
      const height = room?.clientHeight ?? 315;
      const stepped = stepWanderSpot(
        positionRef.current,
        dirRef.current,
        rawDt,
        { width, height },
        undefined,
        undefined,
        undefined,
        obstaclesRef.current,
      );
      if (!stepped.moved) {
        enterIdle(now);
        return;
      }
      commitSpot(stepped.spot);
      if (stepped.hitBound) enterIdle(now);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(pettingTimerRef.current);
      window.clearTimeout(struggleTimerRef.current);
    };
    // commitSpot closes over pet.id; remount when the pet identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional pet.id remount boundary
  }, [pet.id]);

  function clearPettingFx() {
    window.clearTimeout(pettingTimerRef.current);
    setHearts([]);
  }

  function spawnHeart() {
    const id = ++heartIdRef.current;
    const drift = (Math.random() - 0.5) * 28;
    setHearts((current) => [...current, { id, drift }]);
    window.setTimeout(() => {
      setHearts((current) => current.filter((heart) => heart.id !== id));
    }, 1200);
  }

  function beginPetting() {
    if (modeRef.current === "dragging" || pressRef.current?.dragging) return;
    modeRef.current = "petting";
    setMode("petting");
    spawnHeart();
    window.clearTimeout(pettingTimerRef.current);
    pettingTimerRef.current = window.setTimeout(() => {
      const now = performance.now();
      modeRef.current = "idle";
      setMode("idle");
      phaseUntilRef.current = now + randomIdleMs();
    }, PETTING_HOLD_MS);
  }

  const petting = usePetting(beginPetting);

  function moveToForeheadPointer(clientX: number, clientY: number) {
    const roomEl = wrapRef.current?.offsetParent as HTMLElement | null;
    if (!roomEl) return;
    const rect = roomEl.getBoundingClientRect();
    const pct = pointerPercentInRoom(clientX, clientY, rect);
    const wrapHeight = wrapRef.current?.offsetHeight ?? 86;
    const next = spotFromForeheadPointer(pct.left, pct.top, {
      width: rect.width,
      height: rect.height,
    }, wrapHeight);
    commitSpot(next);
  }

  function startDrag() {
    clearPettingFx();
    window.clearTimeout(struggleTimerRef.current);
    setStruggling(false);
    sittingRef.current = false;
    liftSeatRef.current();
    modeRef.current = "dragging";
    setMode("dragging");
    if (pressRef.current) {
      pressRef.current.dragging = true;
      pressRef.current.suppressClick = true;
    }
    struggleTimerRef.current = window.setTimeout(() => {
      if (modeRef.current !== "dragging") return;
      if (reducedRef.current) return;
      setStruggling(true);
    }, DRAG_STRUGGLE_AFTER_MS);
  }

  function endDrag() {
    window.clearTimeout(struggleTimerRef.current);
    setStruggling(false);
    const sat = trySitRef.current(positionRef.current);
    sittingRef.current = sat !== null;
    commitSpot(sat ?? resolveWanderSpot(positionRef.current, undefined, obstaclesRef.current));
    const now = performance.now();
    modeRef.current = "idle";
    setMode("idle");
    phaseUntilRef.current = now + randomIdleMs();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    pressRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      suppressClick: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore — capture is best-effort */
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) {
      petting.onPointerMove(event);
      return;
    }

    if (!press.dragging) {
      if (!dragPastThreshold(press.startX, press.startY, event.clientX, event.clientY)) {
        petting.onPointerMove(event);
        return;
      }
      startDrag();
      moveToForeheadPointer(event.clientX, event.clientY);
      return;
    }

    moveToForeheadPointer(event.clientX, event.clientY);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    if (press.dragging) {
      endDrag();
    }
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
    // Keep suppressClick until onClick so a completed drag does not open the pet.
    if (!press.suppressClick) {
      pressRef.current = null;
    }
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const press = pressRef.current;
    if (press?.dragging) {
      endDrag();
    }
    pressRef.current = null;
    setStruggling(false);
    window.clearTimeout(struggleTimerRef.current);
    petting.onPointerLeave();
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
  }

  function onClick() {
    if (pressRef.current?.suppressClick) {
      pressRef.current = null;
      return;
    }
    pressRef.current = null;
    onOpen(pet.id);
  }

  const sitting = seatedSpot !== null && !dragging;
  const wrapClass = [
    pet.is_desktop_active ? "room-pet-wrap is-equipped" : "room-pet-wrap",
    dragging ? "is-dragging" : null,
    sitting ? "is-sitting" : null,
    struggling ? "is-struggling" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={wrapRef}
      className={wrapClass}
      style={{
        left: `${position.left}%`,
        top: `${position.top}%`,
        // Pets share the room stacking context with furniture (see `.living-room-pets`).
        // Drag lifts above ROOM_DEPTH_Z_MAX so the carried pet is never tucked under a sofa.
        zIndex: dragging ? ROOM_DRAG_Z : sitting && seatZ != null ? seatZ : roomDepthZ(position.top),
      }}
      data-mode={sitting ? "sitting" : mode}
    >
      <button
        type="button"
        className="room-pet"
        aria-label={`View ${displayName}, level ${progress.level}${pet.is_desktop_active ? ", equipped" : ""}`}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={petting.onPointerLeave}
      >
        <span className="room-pet-label">
          <span className="room-pet-label-line">{displayName}</span>
          {!showPetNames ? <span className="room-pet-label-line">Lv.{progress.level}</span> : null}
        </span>
        <span className={faceLeft ? "room-pet-sprite is-flipped" : "room-pet-sprite"}>
          <PixelPetArt
            petType={pet.pet_type}
            color={pet.color}
            hat={pet.hat}
            clothes={pet.clothes}
            pose={pose}
            className={walking ? "is-walking" : undefined}
          />
        </span>
        {pet.is_desktop_active ? <span className="room-equipped">Equipped</span> : null}
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="room-heart"
            style={{ left: `calc(48% + ${heart.drift}px)` }}
            aria-hidden="true"
          >
            <img src={PIXEL_HEART_SRC} alt="" width={16} height={16} draggable={false} />
          </span>
        ))}
      </button>
    </div>
  );
}

function RoomToolIcon({ kind }: { kind: "edit" | "decorate" | "save" }) {
  if (kind === "save") {
    return (
      <svg className="room-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5 9.5 17 19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "decorate") {
    return (
      <svg className="room-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6.5" height="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="13.5" y="4" width="6.5" height="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="13.5" width="6.5" height="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg className="room-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.7 6.3a4.1 4.1 0 0 0-5.7 5.7L4 17v3h3l5-5a4.1 4.1 0 0 0 5.7-5.7l-2.2 2.2-1.8-1.8 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LivingRoom({
  userId,
  pets,
  placedIds,
  placementReady,
  showPetNames = true,
  coins = 0,
  ownedRoomSkins = [],
  onCoinsChange,
  onOpenPet,
  onOpenInventory,
  onOpenSong,
  onOpenAchievements,
  onOpenCollection,
  onOpenSocial,
  tutorialTarget = null,
  dailyStudiedMinutes = null,
  dailyGoalMinutes = null,
  isStudyDay = true,
  headerAside = null,
  headerCenter = null,
  headTitle = null,
  headSubtitle = null,
}: {
  userId: string;
  pets: PetCard[];
  placedIds: ReadonlySet<string>;
  placementReady: boolean;
  showPetNames?: boolean;
  coins?: number;
  ownedRoomSkins?: readonly { categoryId: string; skinId: string }[];
  onCoinsChange?: (coins: number) => void;
  onOpenPet: (petId: string) => void;
  onOpenInventory: () => void;
  onOpenSong?: () => void;
  onOpenAchievements?: () => void;
  onOpenCollection?: () => void;
  onOpenSocial?: () => void;
  tutorialTarget?: string | null;
  dailyStudiedMinutes?: number | null;
  dailyGoalMinutes?: number | null;
  isStudyDay?: boolean;
  headerAside?: ReactNode;
  /** Centered header slot (study countdown while a session is active). */
  headerCenter?: ReactNode;
  /** Replaces the living-room title while a study session is active. */
  headTitle?: string | null;
  headSubtitle?: string | null;
}) {
  const roomTitle = headTitle ?? "Your little living room";
  const roomSubtitle = headSubtitle ?? "Your favorite companions, at home.";
  const studyingHead = Boolean(headTitle);
  const placed = useMemo(() => pets.filter((pet) => placedIds.has(pet.id)), [pets, placedIds]);
  const [savedDecor, setSavedDecor] = useState<RoomDecor>(() => defaultRoomDecor());
  const [draftDecor, setDraftDecor] = useState<RoomDecor | null>(null);
  const [decorOpen, setDecorOpen] = useState(false);
  const [liveCoins, setLiveCoins] = useState(coins);
  const ownedRoomSkinSignature = ownedRoomSkins.map((row) => `${row.categoryId}:${row.skinId}`).join("|");
  const [ownedSkinKeys, setOwnedSkinKeys] = useState(() =>
    ownedRoomSkinKeys(ownedRoomSkins.map((row) => ({ category_id: row.categoryId, skin_id: row.skinId }))),
  );
  const [ownedSkinSnap, setOwnedSkinSnap] = useState(ownedRoomSkinSignature);
  const [seats, setSeats] = useState<SeatMap>({});
  const [seatsReady, setSeatsReady] = useState(false);
  const seatsRef = useRef<SeatMap>({});
  seatsRef.current = seats;
  const editing = draftDecor !== null;
  const decor = draftDecor ?? savedDecor;

  useEffect(() => {
    setLiveCoins(coins);
  }, [coins]);

  if (ownedRoomSkinSignature !== ownedSkinSnap) {
    setOwnedSkinSnap(ownedRoomSkinSignature);
    setOwnedSkinKeys(
      ownedRoomSkinKeys(ownedRoomSkins.map((row) => ({ category_id: row.categoryId, skin_id: row.skinId }))),
    );
  }
  const roomRef = useRef<HTMLDivElement | null>(null);
  const [roomSize, setRoomSize] = useState({ width: ROOM_VIEW_WIDTH, height: ROOM_VIEW_HEIGHT });
  const obstacles = useMemo(() => decorObstacles(decor), [decor]);
  const obstaclesRef = useRef<readonly RoomObstacle[]>(ROOM_OBSTACLES);
  obstaclesRef.current = obstacles;
  const showCylinder =
    !editing && dailyGoalMinutes != null && dailyGoalMinutes > 0 && dailyStudiedMinutes != null;
  const rackActions: Partial<Record<RoomRackHotspotId, (() => void) | undefined>> = {
    song: onOpenSong,
    achievements: onOpenAchievements,
    collection: onOpenCollection,
  };
  const rackZ = roomDepthZ(STORAGE_RACK_DEPTH_TOP) + 1;
  const rackPadZ = roomDepthZ(STORAGE_RACK_DEPTH_TOP) - 1;
  const blackboardZ = roomDepthZ(BLACKBOARD_DEPTH_TOP) + 1;
  const blackboardPadZ = roomDepthZ(BLACKBOARD_DEPTH_TOP) - 1;
  const carpetShift = offsetTransform(decor, "carpet");

  useEffect(() => {
    const loaded = readRoomDecor(userId, ownedSkinKeys);
    setSavedDecor(loaded);
    setDraftDecor(null);
    setDecorOpen(false);
    setSeats(reconcileSeats(loaded, readRoomSeats(userId)));
    setSeatsReady(true);
    // Ownership expands on buy without remounting the dialog; only reload layout on user change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ownedSkinKeys read at user switch
  }, [userId]);

  useEffect(() => {
    if (!seatsReady) return;
    setSeats((current) => {
      const next = reconcileSeats(decor, current);
      return seatsEqual(next, current) ? current : next;
    });
  }, [decor, seatsReady]);

  useEffect(() => {
    if (!seatsReady) return;
    writeRoomSeats(userId, seats);
  }, [seats, seatsReady, userId]);

  function trySit(petId: string, spot: WanderSpot) {
    const result = dropOnSeat(decor, seatsRef.current, petId, spot);
    if (!result) return null;
    seatsRef.current = result.seats;
    setSeats(result.seats);
    return result.spot;
  }

  function liftPet(petId: string) {
    const next = liftSeat(seatsRef.current, petId);
    if (next === seatsRef.current) return;
    seatsRef.current = next;
    setSeats(next);
  }

  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    const update = () => setRoomSize({ width: room.clientWidth, height: room.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(room);
    return () => observer.disconnect();
  }, []);

  function beginEdit() {
    setDraftDecor(cloneRoomDecor(savedDecor));
    setDecorOpen(false);
  }

  function saveEdit() {
    if (!draftDecor) return;
    writeRoomDecor(userId, draftDecor);
    setSavedDecor(draftDecor);
    setDraftDecor(null);
    setDecorOpen(false);
  }

  function onHandlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: DecorMoverId) {
    const room = roomRef.current?.getBoundingClientRect();
    if (!room || !draftDecor) return;
    event.preventDefault();
    const offset = draftDecor.offsets[id] ?? { dx: 0, dy: 0 };
    const drag = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: offset.dx,
      dy: offset.dy,
      width: room.width,
      height: room.height,
    };
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== drag.pointerId) return;
      const dx = drag.dx + ((pointer.clientX - drag.startX) / Math.max(drag.width, 1)) * 100;
      const dy = drag.dy + ((pointer.clientY - drag.startY) / Math.max(drag.height, 1)) * 100;
      setDraftDecor((current) => (current ? moveRoomItem(current, drag.id, dx, dy) : current));
    };
    const up = (pointer: PointerEvent) => {
      if (pointer.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <section className="living-room-block" aria-label={roomTitle}>
      <div className={studyingHead ? "room-top is-studying" : "room-top"}>
        <div className="room-head">
          <h2 className="room-title">{roomTitle}</h2>
          <p className="room-subtitle">{roomSubtitle}</p>
        </div>
        {headerCenter ? <div className="room-center">{headerCenter}</div> : null}
        {headerAside}
      </div>
      <div className="living-room-stage">
        <div className="living-room-shell">
        <div
          ref={roomRef}
          className={editing ? "living-room is-editing" : "living-room"}
          data-wall-skin={decor.skins.wall}
        >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="living-room-layer is-wall"
          src={roomBackgroundSrc("wall", decor.skins.wall, ROOM_WALL_SRC)}
          alt=""
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="living-room-layer is-floor"
          src={roomBackgroundSrc("floor", decor.skins.floor, ROOM_FLOOR_SRC)}
          alt=""
          draggable={false}
        />
        {isRoomItemPlaced(decor, "carpet") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="living-room-layer is-carpet"
            src={roomBackgroundSrc("carpet", decor.skins.carpet, ROOM_CARPET_SRC)}
            alt=""
            draggable={false}
            style={carpetShift ? { transform: carpetShift } : undefined}
          />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="living-room-layer is-trim"
          src={roomBackgroundSrc("trim", decor.skins.trim, ROOM_TRIM_SRC)}
          alt=""
          draggable={false}
        />
        {ROOM_FURNITURE.map((item) =>
          isFurniturePlaced(decor, item.id) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              className="living-room-layer is-furniture"
              src={roomFurnitureSrc(item, decor)}
              alt=""
              draggable={false}
              data-furniture={item.id}
              style={{
                zIndex: roomDepthZ(item.depthTop),
                transform: offsetTransform(decor, item.id),
              }}
            />
          ) : null,
        )}
        {/* Prop hotspots: glow under furniture art, hit target + label on top. */}
        {editing
          ? null
          : ROOM_RACK_HOTSPOTS.flatMap((spot) => {
              const action = rackActions[spot.id];
              if (!action) return [];
              const box = coverBox(
                spot.bounds,
                roomSize.width,
                roomSize.height,
                decor.offsets["storage-rack"],
              );
              const boxStyle = {
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              };
              return [
                <span
                  key={`${spot.id}-pad`}
                  className="room-prop-hotspot-pad"
                  aria-hidden="true"
                  data-prop-hotspot={spot.id}
                  data-rack-hotspot={spot.id}
                  style={{ ...boxStyle, zIndex: rackPadZ }}
                />,
                <button
                  key={`${spot.id}-btn`}
                  type="button"
                  className="room-prop-hotspot"
                  aria-label={spot.label}
                  data-tutorial={spot.id}
                  data-tutorial-current={tutorialTarget === spot.id ? "true" : undefined}
                  data-prop-hotspot={spot.id}
                  data-rack-hotspot={spot.id}
                  style={{ ...boxStyle, zIndex: rackZ }}
                  onClick={action}
                >
                  <span className="room-prop-hotspot-label">{spot.label}</span>
                </button>,
              ];
            })}
        {!editing && onOpenSocial
          ? ROOM_WALL_HOTSPOTS.flatMap((spot) => {
              const box = coverBox(
                spot.bounds,
                roomSize.width,
                roomSize.height,
                decor.offsets.blackboard,
              );
              const boxStyle = {
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              };
              return [
                <span
                  key={`${spot.id}-pad`}
                  className="room-prop-hotspot-pad"
                  aria-hidden="true"
                  data-prop-hotspot={spot.id}
                  data-wall-hotspot={spot.id}
                  style={{ ...boxStyle, zIndex: blackboardPadZ }}
                />,
                <button
                  key={`${spot.id}-btn`}
                  type="button"
                  className="room-prop-hotspot"
                  aria-label={spot.label}
                  data-tutorial={spot.tutorialTarget}
                  data-tutorial-current={tutorialTarget === spot.tutorialTarget ? "true" : undefined}
                  data-prop-hotspot={spot.id}
                  data-wall-hotspot={spot.id}
                  style={{ ...boxStyle, zIndex: blackboardZ }}
                  onClick={onOpenSocial}
                >
                  <span className="room-prop-hotspot-label">{spot.label}</span>
                </button>,
              ];
            })
          : null}
        {editing
          ? decorHandles(decor).map((handle) => {
              const box = coverBox(moverBounds(handle.id), roomSize.width, roomSize.height, decor.offsets[handle.id]);
              return (
                <button
                  key={handle.id}
                  type="button"
                  className="room-edit-handle"
                  aria-label={`Move ${handle.label}`}
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                  }}
                  onPointerDown={(event) => onHandlePointerDown(event, handle.id)}
                />
              );
            })
          : null}
        {!editing && showCylinder ? (
          <div className="room-side-dock">
            <DailyProgressCylinder
              studiedMinutes={dailyStudiedMinutes ?? 0}
              goalMinutes={dailyGoalMinutes ?? 0}
              isStudyDay={isStudyDay}
            />
          </div>
        ) : null}
        {editing ? null : (
          <div className="living-room-pets">
            {placed.map((pet) => {
              const assignment = seats[pet.id];
              return (
                <RoomPet
                  key={pet.id}
                  pet={pet}
                  paused={false}
                  showPetNames={showPetNames}
                  onOpen={onOpenPet}
                  obstaclesRef={obstaclesRef}
                  seatedSpot={assignment ? seatAnchor(decor, assignment) : null}
                  seatZ={assignment ? seatPaintZ(assignment.pieceId) : null}
                  onTrySit={(spot) => trySit(pet.id, spot)}
                  onLiftSeat={() => liftPet(pet.id)}
                />
              );
            })}
          </div>
        )}
        {!editing && placementReady && placed.length === 0 ? (
          <div className="room-empty">
            <p>No pets in the room yet.</p>
            <button type="button" className="button" onClick={onOpenInventory}>
              Open Inventory
            </button>
          </div>
        ) : null}
        </div>
        <div className="room-tool-rail">
          {editing ? (
            <button type="button" className="room-tool-button" aria-label="Decorate" onClick={() => setDecorOpen(true)}>
              <RoomToolIcon kind="decorate" />
            </button>
          ) : null}
          <button
            type="button"
            className="room-tool-button"
            aria-label={editing ? "Save" : "Edit room"}
            onClick={editing ? saveEdit : beginEdit}
          >
            <RoomToolIcon kind={editing ? "save" : "edit"} />
          </button>
        </div>
        </div>
      </div>
      {editing && decorOpen && draftDecor ? (
        <RoomDecorateDialog
          decor={draftDecor}
          coins={liveCoins}
          ownedSkinKeys={ownedSkinKeys}
          onChange={setDraftDecor}
          onCoinsChange={(next) => {
            setLiveCoins(next);
            onCoinsChange?.(next);
          }}
          onOwnedSkinsChange={setOwnedSkinKeys}
          onClose={() => setDecorOpen(false)}
        />
      ) : null}
    </section>
  );
}
