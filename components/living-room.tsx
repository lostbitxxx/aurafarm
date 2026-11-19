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
}: {
  pet: PetCard;
  paused: boolean;
  showPetNames: boolean;
  onOpen: (petId: string) => void;
  obstaclesRef: RefObject<readonly RoomObstacle[]>;
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
    commitSpot(resolveWanderSpot(positionRef.current, undefined, obstaclesRef.current));

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
    commitSpot(resolveWanderSpot(positionRef.current, undefined, obstaclesRef.current));
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

  const wrapClass = [
    pet.is_desktop_active ? "room-pet-wrap is-equipped" : "room-pet-wrap",
    dragging ? "is-dragging" : null,
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
        zIndex: dragging ? ROOM_DRAG_Z : roomDepthZ(position.top),
      }}
      data-mode={mode}
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
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
}: {
  userId: string;
  pets: PetCard[];
  placedIds: ReadonlySet<string>;
  placementReady: boolean;
  showPetNames?: boolean;
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
}) {
  const placed = useMemo(() => pets.filter((pet) => placedIds.has(pet.id)), [pets, placedIds]);
  const [savedDecor, setSavedDecor] = useState<RoomDecor>(() => defaultRoomDecor());
  const [draftDecor, setDraftDecor] = useState<RoomDecor | null>(null);
  const [decorOpen, setDecorOpen] = useState(false);
  const editing = draftDecor !== null;
  const decor = draftDecor ?? savedDecor;
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
  const blackboardZ = roomDepthZ(BLACKBOARD_DEPTH_TOP) + 1;
  const carpetShift = offsetTransform(decor, "carpet");
  const rackShift = offsetTransform(decor, "storage-rack");
  const boardShift = offsetTransform(decor, "blackboard");

  useEffect(() => {
    setSavedDecor(readRoomDecor(userId));
    setDraftDecor(null);
    setDecorOpen(false);
  }, [userId]);

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
    <section className="living-room-block" aria-label="Your little living room">
      <div className="room-top">
        <div className="room-head">
          <h2 className="room-title">Your little living room</h2>
          <p className="room-subtitle">Your favorite companions, at home.</p>
        </div>
        {headerAside}
      </div>
      <div ref={roomRef} className={editing ? "living-room is-editing" : "living-room"}>
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
        {/*
          SVG hit layer shares the furniture viewBox + slice so click targets stay
          glued to art when .living-room aspect ratio ≠ 2:1 (object-fit: cover).
        */}
        {editing ? null : (
          <svg
            className="living-room-rack-hotspots"
            viewBox={`0 0 ${ROOM_VIEW_WIDTH} ${ROOM_VIEW_HEIGHT}`}
            preserveAspectRatio="xMidYMid slice"
            style={{ zIndex: rackZ, transform: rackShift }}
          >
            {ROOM_RACK_HOTSPOTS.map((spot) => {
              const action = rackActions[spot.id];
              if (!action) return null;
              return (
                <rect
                  key={spot.id}
                  className="room-rack-hotspot"
                  role="button"
                  tabIndex={0}
                  aria-label={spot.label}
                  data-tutorial={spot.id}
                  data-tutorial-current={tutorialTarget === spot.id ? "true" : undefined}
                  data-rack-hotspot={spot.id}
                  x={spot.bounds.x}
                  y={spot.bounds.y}
                  width={spot.bounds.width}
                  height={spot.bounds.height}
                  onClick={action}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      action();
                    }
                  }}
                />
              );
            })}
          </svg>
        )}
        {!editing && onOpenSocial ? (
          <svg
            className="living-room-wall-hotspots"
            viewBox={`0 0 ${ROOM_VIEW_WIDTH} ${ROOM_VIEW_HEIGHT}`}
            preserveAspectRatio="xMidYMid slice"
            style={{ zIndex: blackboardZ, transform: boardShift }}
          >
            {ROOM_WALL_HOTSPOTS.map((spot) => (
              <rect
                key={spot.id}
                className="room-rack-hotspot"
                role="button"
                tabIndex={0}
                aria-label={spot.label}
                data-tutorial={spot.tutorialTarget}
                data-tutorial-current={tutorialTarget === spot.tutorialTarget ? "true" : undefined}
                data-wall-hotspot={spot.id}
                x={spot.bounds.x}
                y={spot.bounds.y}
                width={spot.bounds.width}
                height={spot.bounds.height}
                onClick={onOpenSocial}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenSocial();
                  }
                }}
              />
            ))}
          </svg>
        ) : null}
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
        <div className="room-side-dock">
          {editing ? (
            <button type="button" className="room-tool-button" aria-label="Decorate" onClick={() => setDecorOpen(true)}>
              <RoomToolIcon kind="decorate" />
            </button>
          ) : showCylinder ? (
            <DailyProgressCylinder
              studiedMinutes={dailyStudiedMinutes ?? 0}
              goalMinutes={dailyGoalMinutes ?? 0}
              isStudyDay={isStudyDay}
            />
          ) : (
            <span className="room-side-spacer" />
          )}
          <button
            type="button"
            className="room-tool-button is-bottom"
            aria-label={editing ? "Save" : "Edit room"}
            onClick={editing ? saveEdit : beginEdit}
          >
            <RoomToolIcon kind={editing ? "save" : "edit"} />
          </button>
        </div>
        {editing ? null : (
          <div className="living-room-pets">
            {placed.map((pet) => (
              <RoomPet
                key={pet.id}
                pet={pet}
                paused={false}
                showPetNames={showPetNames}
                onOpen={onOpenPet}
                obstaclesRef={obstaclesRef}
              />
            ))}
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
      {editing && decorOpen && draftDecor ? (
        <RoomDecorateDialog decor={draftDecor} onChange={setDraftDecor} onClose={() => setDecorOpen(false)} />
      ) : null}
    </section>
  );
}
