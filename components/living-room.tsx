"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ROOM_CARPET_SRC,
  ROOM_FLOOR_SRC,
  ROOM_FURNITURE,
  ROOM_TRIM_SRC,
  ROOM_WALL_SRC,
  roomDepthZ,
} from "@/lib/living-room-layout";
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
import { describePet, type PetCard } from "@/lib/pets";
import { experienceProgress } from "@/lib/study";
import { DailyProgressCylinder } from "./daily-progress-cylinder";
import { PixelPetArt, usePetting, useWalkPose } from "./pixel-pet";

type Mode = "idle" | "walking" | "petting" | "dragging";

function RoomPet({
  pet,
  paused,
  onOpen,
}: {
  pet: PetCard;
  paused: boolean;
  onOpen: (petId: string) => void;
}) {
  const copy = describePet(pet.pet_type);
  const progress = experienceProgress(pet.xp);
  const [position, setPosition] = useState(() => sessionOrRandomWanderSpot(pet.id));
  const [mode, setMode] = useState<Mode>("idle");
  const [faceLeft, setFaceLeft] = useState(false);
  const [heart, setHeart] = useState(false);
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
  const heartTimerRef = useRef(0);
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
  // Petting keeps blush reactions on the leveled standing blush frame.
  // Idle/waiting always select idle explicitly from movement state (never a leftover walk frame).
  const pose = mode === "petting" ? "blush" : walking ? walkPose : "idle";

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
    commitSpot(resolveWanderSpot(positionRef.current));

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
      const freed = resolveWanderSpot(positionRef.current);
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
      const stepped = stepWanderSpot(positionRef.current, dirRef.current, rawDt, { width, height });
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
      window.clearTimeout(heartTimerRef.current);
      window.clearTimeout(struggleTimerRef.current);
    };
    // commitSpot closes over pet.id; remount when the pet identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional pet.id remount boundary
  }, [pet.id]);

  function clearPettingFx() {
    window.clearTimeout(pettingTimerRef.current);
    window.clearTimeout(heartTimerRef.current);
    setHeart(false);
  }

  function beginPetting() {
    if (modeRef.current === "dragging" || pressRef.current?.dragging) return;
    modeRef.current = "petting";
    setMode("petting");
    setHeart(true);
    window.clearTimeout(pettingTimerRef.current);
    window.clearTimeout(heartTimerRef.current);
    heartTimerRef.current = window.setTimeout(() => setHeart(false), 1200);
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
    commitSpot(resolveWanderSpot(positionRef.current));
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
        zIndex: dragging ? 210 : roomDepthZ(position.top),
      }}
      data-mode={mode}
    >
      <button
        type="button"
        className="room-pet"
        aria-label={`View ${copy.name}, level ${progress.level}${pet.is_desktop_active ? ", equipped" : ""}`}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={petting.onPointerLeave}
      >
        <span className="room-pet-label">Lv.{progress.level}</span>
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
        {heart ? (
          <span className="room-heart" aria-hidden="true">
            ♥
          </span>
        ) : null}
      </button>
    </div>
  );
}

export function LivingRoom({
  pets,
  placedIds,
  placementReady,
  onOpenPet,
  onOpenInventory,
  dailyStudiedMinutes = null,
  dailyGoalMinutes = null,
  isStudyDay = true,
}: {
  pets: PetCard[];
  placedIds: ReadonlySet<string>;
  placementReady: boolean;
  onOpenPet: (petId: string) => void;
  onOpenInventory: () => void;
  dailyStudiedMinutes?: number | null;
  dailyGoalMinutes?: number | null;
  isStudyDay?: boolean;
}) {
  const placed = useMemo(() => pets.filter((pet) => placedIds.has(pet.id)), [pets, placedIds]);
  const showCylinder =
    dailyGoalMinutes != null && dailyGoalMinutes > 0 && dailyStudiedMinutes != null;

  return (
    <section className="living-room-block" aria-label="Your little living room">
      <div className="room-head">
        <h2 className="room-title">Your little living room</h2>
        <p className="room-subtitle">Your favorite companions, at home.</p>
      </div>
      <div className="living-room">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="living-room-layer is-wall" src={ROOM_WALL_SRC} alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="living-room-layer is-floor" src={ROOM_FLOOR_SRC} alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="living-room-layer is-carpet" src={ROOM_CARPET_SRC} alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="living-room-layer is-trim" src={ROOM_TRIM_SRC} alt="" draggable={false} />
        {ROOM_FURNITURE.map((item) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            className="living-room-layer is-furniture"
            src={item.src}
            alt=""
            draggable={false}
            data-furniture={item.id}
            style={{ zIndex: roomDepthZ(item.depthTop) }}
          />
        ))}
        {showCylinder ? (
          <DailyProgressCylinder
            studiedMinutes={dailyStudiedMinutes}
            goalMinutes={dailyGoalMinutes}
            isStudyDay={isStudyDay}
          />
        ) : null}
        <div className="living-room-pets">
          {placed.map((pet) => (
            <RoomPet key={pet.id} pet={pet} paused={false} onOpen={onOpenPet} />
          ))}
        </div>
        {placementReady && placed.length === 0 ? (
          <div className="room-empty">
            <p>No pets in the room yet.</p>
            <button type="button" className="button" onClick={onOpenInventory}>
              Open Inventory
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
