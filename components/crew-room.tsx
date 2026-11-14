"use client";

import { useEffect, useRef, useState } from "react";
import {
  facingFromDirection,
  pickWalkDirection,
  randomIdleMs,
  randomWalkMs,
  stepWanderSpot,
  type WanderDir,
  type WanderSpot,
} from "@/lib/living-room-wander";
import { ROOM_ASSET_PATH } from "@/lib/pet-assets";
import type { CrewOccupant } from "@/lib/farm-crew";
import { PixelPetArt, useWalkPose } from "./pixel-pet";

function spotForIndex(index: number): WanderSpot {
  const left = 18 + (index % 4) * 18;
  const top = 46 + (index % 3) * 4;
  return { left, top };
}

function CrewFarmer({ occupant, spot }: { occupant: CrewOccupant; spot: WanderSpot }) {
  const studying = occupant.presence === "aurafarming";
  const [position, setPosition] = useState(spot);
  const [walking, setWalking] = useState(false);
  const [faceLeft, setFaceLeft] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(spot);
  const dirRef = useRef<WanderDir>({ x: 1, y: 0 });
  const faceLeftRef = useRef(false);
  const walkingRef = useRef(false);
  const phaseUntilRef = useRef(0);
  const walkPose = useWalkPose(walking && !studying);

  useEffect(() => {
    if (studying) return;
    let frame = 0;
    let last = performance.now();
    phaseUntilRef.current = last + randomIdleMs();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const enterIdle = (now: number) => {
      if (walkingRef.current) {
        walkingRef.current = false;
        setWalking(false);
      }
      phaseUntilRef.current = now + randomIdleMs();
    };

    const enterWalk = (now: number) => {
      if (media.matches) {
        enterIdle(now);
        return;
      }
      dirRef.current = pickWalkDirection();
      const nextFace = facingFromDirection(dirRef.current, faceLeftRef.current);
      if (nextFace !== faceLeftRef.current) {
        faceLeftRef.current = nextFace;
        setFaceLeft(nextFace);
      }
      walkingRef.current = true;
      setWalking(true);
      phaseUntilRef.current = now + randomWalkMs();
    };

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const rawDt = (now - last) / 1000;
      last = now;
      if (!walkingRef.current) {
        if (now >= phaseUntilRef.current) enterWalk(now);
        return;
      }
      if (now >= phaseUntilRef.current) {
        enterIdle(now);
        return;
      }
      const room = wrapRef.current?.offsetParent as HTMLElement | null;
      const stepped = stepWanderSpot(positionRef.current, dirRef.current, rawDt, {
        width: room?.clientWidth ?? 640,
        height: room?.clientHeight ?? 315,
      });
      if (!stepped.moved) {
        enterIdle(now);
        return;
      }
      positionRef.current = stepped.spot;
      setPosition(stepped.spot);
      if (stepped.hitBound) enterIdle(now);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [studying, occupant.farmerId]);

  return (
    <div
      ref={wrapRef}
      className="room-pet-wrap"
      style={{ left: `${position.left}%`, top: `${position.top}%` }}
    >
      <div className="room-pet">
        <span className="room-pet-label">{occupant.displayName}</span>
        <span className={faceLeft ? "room-pet-sprite is-flipped" : "room-pet-sprite"}>
          <PixelPetArt
            petType={occupant.petType}
            color={occupant.color}
            hat={occupant.hat}
            clothes={occupant.clothes}
            pose={studying ? "study1" : walking ? walkPose : "idle"}
            className={walking && !studying ? "is-walking" : undefined}
            alt=""
          />
        </span>
        <span className={studying ? "crew-room-status is-farming" : "crew-room-status"}>
          {studying ? "Aurafarming" : "Online"}
        </span>
      </div>
    </div>
  );
}

export function CrewRoom({ occupants }: { occupants: readonly CrewOccupant[] }) {
  return (
    <div className="living-room">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="living-room-art" src={ROOM_ASSET_PATH} alt="" draggable={false} />
      <div className="living-room-pets">
        {occupants.map((occupant, index) => (
          <CrewFarmer key={occupant.farmerId} occupant={occupant} spot={spotForIndex(index)} />
        ))}
      </div>
      {occupants.length === 0 ? (
        <div className="room-empty">
          <p>Nobody is in the crew room right now.</p>
        </div>
      ) : null}
    </div>
  );
}
