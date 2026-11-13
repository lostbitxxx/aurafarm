"use client";

import { useEffect, useMemo, useState } from "react";
import { describePet, type PetCard } from "@/lib/pets";
import { experienceProgress } from "@/lib/study";
import { ROOM_ASSET_PATH, ROOM_PLACEMENT_NOTE } from "@/lib/pet-assets";
import { PixelPetArt, usePetting, useWalkPose } from "./pixel-pet";

type Spot = { left: number; top: number };

const WALK_BOUNDS = { minLeft: 8, maxLeft: 78, minTop: 42, maxTop: 58 };

function spotForIndex(index: number): Spot {
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
  spot: Spot;
  paused: boolean;
  onOpen: (petId: string) => void;
}) {
  const copy = describePet(pet.pet_type);
  const progress = experienceProgress(pet.xp);
  const [blush, setBlush] = useState(false);
  const [heart, setHeart] = useState(false);
  const [position, setPosition] = useState(spot);
  const walkPose = useWalkPose(!paused && !blush);
  const pose = blush ? "blush" : walkPose;

  useEffect(() => {
    setPosition(spot);
  }, [spot.left, spot.top]);

  useEffect(() => {
    if (paused || blush) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    let cancelled = false;
    let timer = 0;

    const wander = () => {
      if (cancelled) return;
      setPosition({
        left: WALK_BOUNDS.minLeft + Math.random() * (WALK_BOUNDS.maxLeft - WALK_BOUNDS.minLeft),
        top: WALK_BOUNDS.minTop + Math.random() * (WALK_BOUNDS.maxTop - WALK_BOUNDS.minTop),
      });
      timer = window.setTimeout(wander, 3200 + Math.random() * 2800);
    };

    timer = window.setTimeout(wander, 900 + Math.random() * 1600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [paused, blush, pet.id]);

  function triggerPet() {
    setBlush(true);
    setHeart(true);
    window.setTimeout(() => setHeart(false), 1200);
    window.setTimeout(() => setBlush(false), 1500);
  }

  const petting = usePetting(triggerPet);

  return (
    <div className={pet.is_desktop_active ? "room-pet-wrap is-equipped" : "room-pet-wrap"} style={{ left: `${position.left}%`, top: `${position.top}%` }}>
      <button
        type="button"
        className="room-pet"
        aria-label={`View ${copy.name}, level ${progress.level}${pet.is_desktop_active ? ", equipped" : ""}`}
        onClick={() => onOpen(pet.id)}
        onPointerMove={petting.onPointerMove}
        onPointerLeave={petting.onPointerLeave}
      >
        <span className="room-pet-label">Lv.{progress.level}</span>
        <PixelPetArt
          petType={pet.pet_type}
          color={pet.color}
          hat={pet.hat}
          clothes={pet.clothes}
          pose={pose}
          className={String(pose).startsWith("walk") ? "is-walking" : undefined}
        />
        {pet.is_desktop_active ? <span className="room-equipped">Equipped</span> : null}
        {heart ? (
          <span className="room-heart" aria-hidden="true">
            ♥
          </span>
        ) : null}
      </button>
      <button type="button" className="room-pet-button" onClick={triggerPet}>
        Pet
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
            <RoomPet key={pet.id} pet={pet} spot={spotForIndex(index)} paused={false} onOpen={onOpenPet} />
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
        {placementReady && placed.length > 0 ? (
          <p className="room-note">Stroke left ↔ right to pet · Click to inspect</p>
        ) : null}
      </div>
      <p className="room-persist-note">{ROOM_PLACEMENT_NOTE}</p>
    </section>
  );
}
