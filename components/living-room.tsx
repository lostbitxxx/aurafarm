"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  facingFromDirection,
  PETTING_HOLD_MS,
  pickWalkDirection,
  randomIdleMs,
  randomWalkMs,
  stepWanderSpot,
  type WanderDir,
  type WanderSpot,
} from "@/lib/living-room-wander";
import { describePet, type PetCard } from "@/lib/pets";
import { experienceProgress } from "@/lib/study";
import { ROOM_ASSET_PATH } from "@/lib/pet-assets";
import { PixelPetArt, usePetting, useWalkPose } from "./pixel-pet";

type Mode = "idle" | "walking" | "petting";

function spotForIndex(index: number): WanderSpot {
  const left = 18 + (index % 4) * 18;
  const top = 46 + (index % 3) * 4;
  return { left, top };
}

function RoomPet({
  pet,
  spot,
  paused,
  onOpen,
}: {
  pet: PetCard;
  spot: WanderSpot;
  paused: boolean;
  onOpen: (petId: string) => void;
}) {
  const copy = describePet(pet.pet_type);
  const progress = experienceProgress(pet.xp);
  const [position, setPosition] = useState(spot);
  const [mode, setMode] = useState<Mode>("idle");
  const [faceLeft, setFaceLeft] = useState(false);
  const [heart, setHeart] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<Mode>("idle");
  const positionRef = useRef(spot);
  const dirRef = useRef<WanderDir>({ x: 1, y: 0 });
  const faceLeftRef = useRef(false);
  const phaseUntilRef = useRef(0);
  const pettingTimerRef = useRef(0);
  const heartTimerRef = useRef(0);
  const reducedRef = useRef(false);
  const pausedRef = useRef(paused);

  const walking = mode === "walking";
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

      if (current === "petting") return;

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
      positionRef.current = stepped.spot;
      setPosition(stepped.spot);
      if (stepped.hitBound) enterIdle(now);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(pettingTimerRef.current);
      window.clearTimeout(heartTimerRef.current);
    };
  }, [pet.id]);

  function beginPetting() {
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

  return (
    <div
      ref={wrapRef}
      className={pet.is_desktop_active ? "room-pet-wrap is-equipped" : "room-pet-wrap"}
      style={{ left: `${position.left}%`, top: `${position.top}%` }}
      data-mode={mode}
    >
      <button
        type="button"
        className="room-pet"
        aria-label={`View ${copy.name}, level ${progress.level}${pet.is_desktop_active ? ", equipped" : ""}`}
        onClick={() => onOpen(pet.id)}
        onPointerMove={petting.onPointerMove}
        onPointerLeave={petting.onPointerLeave}
        onPointerCancel={petting.onPointerLeave}
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
}: {
  pets: PetCard[];
  placedIds: ReadonlySet<string>;
  placementReady: boolean;
  onOpenPet: (petId: string) => void;
  onOpenInventory: () => void;
}) {
  const placed = useMemo(() => pets.filter((pet) => placedIds.has(pet.id)), [pets, placedIds]);

  return (
    <section className="living-room-block" aria-label="Your little living room">
      <div className="room-head">
        <h2 className="room-title">Your little living room</h2>
        <p className="room-subtitle">Your favorite companions, at home.</p>
      </div>
      <div className="living-room">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="living-room-art" src={ROOM_ASSET_PATH} alt="" draggable={false} />
        <div className="living-room-pets">
          {placed.map((pet, index) => (
            <RoomPet
              key={`${pet.id}-${index}`}
              pet={pet}
              spot={spotForIndex(index)}
              paused={false}
              onOpen={onOpenPet}
            />
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
