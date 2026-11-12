"use client";

import { useState } from "react";
import { equipPetToDesktop } from "@/lib/actions/pets";
import { ACCESSORY_NOTE, EQUIP_DURING_SESSION_NOTE } from "@/lib/pet-assets";
import { describePet, type PetCard } from "@/lib/pets";
import { experienceProgress } from "@/lib/study";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt, usePetting } from "./pixel-pet";

export function PetDetailDialog({
  pet,
  sessionActive,
  onClose,
  onEquipped,
}: {
  pet: PetCard;
  sessionActive: boolean;
  onClose: () => void;
  onEquipped?: (petId: string) => void;
}) {
  const copy = describePet(pet.pet_type);
  const progress = experienceProgress(pet.xp);
  const [pose, setPose] = useState<"idle" | "blush">("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipped, setEquipped] = useState(pet.is_desktop_active);

  function blush() {
    setPose("blush");
    window.setTimeout(() => setPose("idle"), 1500);
  }

  const petting = usePetting(blush);

  async function onEquip() {
    if (pending || equipped || sessionActive) return;
    setPending(true);
    setError(null);
    const result = await equipPetToDesktop(pet.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEquipped(true);
    onEquipped?.(pet.id);
  }

  return (
    <FarmDialog title={copy.name} onClose={onClose} wide>
      <div className="pet-detail">
        <div>
          <div className="big-pet" onPointerMove={petting.onPointerMove} onPointerLeave={petting.onPointerLeave}>
            <PixelPetArt petType={pet.pet_type} color={pet.color} pose={pose} className="big-pet-art" />
          </div>
          <p className="panel-hint" style={{ textAlign: "center" }}>
            Stroke left ↔ right to pet
          </p>
          <button
            type="button"
            className="button button-ghost"
            style={{ display: "block", margin: "0.6rem auto" }}
            onClick={blush}
          >
            Pet ♡
          </button>
        </div>
        <div>
          <p className="panel-kicker">Unique pet instance</p>
          <h3 className="panel-name">
            {copy.name} · Lv.{progress.level}
          </h3>
          <div
            className="xp-track xp-track-purple"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.intoLevel}
            aria-label={`${copy.name} experience`}
          >
            <span className="xp-fill" style={{ width: `${progress.intoLevel}%` }} />
          </div>
          <p className="growth-label">
            {progress.intoLevel} / 100 XP
          </p>
          <div className="accessory-slots" aria-label="Accessories">
            <button type="button" className="accessory-slot" disabled title={ACCESSORY_NOTE}>
              Color
              <b>Coming soon</b>
            </button>
            <button type="button" className="accessory-slot" disabled title={ACCESSORY_NOTE}>
              Hat
              <b>Coming soon</b>
            </button>
            <button type="button" className="accessory-slot" disabled title={ACCESSORY_NOTE}>
              Clothes
              <b>Coming soon</b>
            </button>
          </div>
          <p className="panel-hint">{ACCESSORY_NOTE}</p>
          <div className="tracker-actions">
            <button
              type="button"
              className="button"
              disabled={pending || equipped || sessionActive}
              title={sessionActive && !equipped ? EQUIP_DURING_SESSION_NOTE : undefined}
              onClick={onEquip}
            >
              {equipped ? "Equipped" : sessionActive ? "Locked during session" : "Equip pet"}
            </button>
          </div>
          {sessionActive ? <p className="panel-hint">{EQUIP_DURING_SESSION_NOTE}</p> : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </FarmDialog>
  );
}
