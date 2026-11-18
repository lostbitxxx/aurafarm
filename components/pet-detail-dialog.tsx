"use client";

import { useState, type FormEvent } from "react";
import { applyPetClothes, applyPetColor, applyPetHat, equipPetToDesktop, renamePet } from "@/lib/actions/pets";
import {
  collectionNoneCard,
  ownedPreviewRewards,
  previewReward,
  type PreviewReward,
} from "@/lib/collection-catalog";
import {
  colorForPetType,
  EQUIP_DURING_SESSION_NOTE,
  sampleAccessoryIcon,
  sampleAccessoryName,
  SAMPLE_CLOTHES,
  SAMPLE_COLORS,
  SAMPLE_HATS,
} from "@/lib/pet-assets";
import { petDisplayName, type PetCard } from "@/lib/pets";
import { RENAME_PET_NAME_MAX } from "@/lib/rename-coupon";
import { experienceProgress } from "@/lib/study";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt, usePetting } from "./pixel-pet";

const COLLECTION_NONE = collectionNoneCard();

type SlotPicker = "color" | "hat" | "clothes";

function colorDisplayName(colorId: string | null | undefined, petType: string) {
  if (colorId) {
    return SAMPLE_COLORS.find((color) => color.id === colorId)?.name ?? colorId;
  }
  const fallback = colorForPetType(petType);
  return SAMPLE_COLORS.find((color) => color.id === fallback)?.name ?? fallback;
}

function resolvedColorId(colorId: string | null | undefined, petType: string) {
  return colorId || colorForPetType(petType);
}

function accessoryDisplayName(kind: "hat" | "clothes", id: string | null | undefined) {
  if (!id) return COLLECTION_NONE.name;
  return previewReward(id)?.name ?? sampleAccessoryName(kind, id) ?? id;
}

function accessoryIconSrc(kind: "hat" | "clothes", id: string | null | undefined) {
  if (!id) return COLLECTION_NONE.icon;
  return previewReward(id)?.icon ?? sampleAccessoryIcon(kind, id) ?? COLLECTION_NONE.icon;
}

export function PetDetailDialog({
  pet,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  renameCoupons = 0,
  sessionActive,
  onClose,
  onEquipped,
  onColorApplied,
  onHatApplied,
  onClothesApplied,
  onPetRenamed,
}: {
  pet: PetCard;
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  renameCoupons?: number;
  sessionActive: boolean;
  onClose: () => void;
  onEquipped?: (petId: string) => void;
  onColorApplied: (petId: string, colorId: string) => void;
  onHatApplied: (petId: string, hatId: string | null) => void;
  onClothesApplied: (petId: string, clothesId: string | null) => void;
  onPetRenamed?: (petId: string, name: string) => void;
}) {
  const displayName = petDisplayName(pet);
  const progress = experienceProgress(pet.xp);
  const [pose, setPose] = useState<"idle" | "blush">("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipped, setEquipped] = useState(pet.is_desktop_active);
  const [picker, setPicker] = useState<SlotPicker | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(displayName);

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

  function startRename() {
    if (pending || renameCoupons < 1) return;
    setError(null);
    setDraftName(displayName);
    setRenaming(true);
  }

  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || renameCoupons < 1) return;
    setPending(true);
    setError(null);
    const result = await renamePet(pet.id, draftName);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const nextName = result.name ?? draftName.trim();
    onPetRenamed?.(pet.id, nextName);
    setRenaming(false);
  }

  if (picker === "color") {
    return (
      <PetColorPicker
        pet={pet}
        ownedColorIds={ownedColorIds}
        onClose={() => setPicker(null)}
        onApplied={(colorId) => {
          onColorApplied(pet.id, colorId);
          setPicker(null);
        }}
      />
    );
  }

  if (picker === "hat") {
    return (
      <PetAccessoryPicker
        pet={pet}
        kind="hat"
        ownedIds={ownedHatIds}
        selectedId={pet.hat}
        onClose={() => setPicker(null)}
        onApplied={(hatId) => {
          onHatApplied(pet.id, hatId);
          setPicker(null);
        }}
      />
    );
  }

  if (picker === "clothes") {
    return (
      <PetAccessoryPicker
        pet={pet}
        kind="clothes"
        ownedIds={ownedClothesIds}
        selectedId={pet.clothes}
        onClose={() => setPicker(null)}
        onApplied={(clothesId) => {
          onClothesApplied(pet.id, clothesId);
          setPicker(null);
        }}
      />
    );
  }

  return (
    <FarmDialog title={displayName} onClose={onClose} wide>
      <div className="pet-detail">
        <div>
          <div className="big-pet" onPointerMove={petting.onPointerMove} onPointerLeave={petting.onPointerLeave}>
            <PixelPetArt petType={pet.pet_type} color={pet.color} hat={pet.hat} clothes={pet.clothes} pose={pose} className="big-pet-art" />
          </div>
          <p className="panel-hint" style={{ textAlign: "center" }}>
            Stroke left ↔ right to pet
          </p>
          <button
            type="button"
            className={
              pose === "blush"
                ? "button pet-love-button is-lit"
                : "button button-ghost pet-love-button"
            }
            aria-pressed={pose === "blush"}
            onClick={blush}
          >
            Pet ♡
          </button>
        </div>
        <div>
          <p className="panel-kicker">Unique pet instance</p>
          <h3 className="panel-name">Lv.{progress.level}</h3>
          <div
            className="xp-track xp-track-purple"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.intoLevel}
            aria-label={`${displayName} experience`}
          >
            <span className="xp-fill" style={{ width: `${progress.intoLevel}%` }} />
          </div>
          <p className="growth-label">
            {progress.intoLevel} / 100 XP
          </p>
          <div className="accessory-slots" aria-label="Accessories">
            <button
              type="button"
              className="accessory-slot"
              aria-label={`Color: ${colorDisplayName(pet.color, pet.pet_type)}`}
              onClick={() => setPicker("color")}
            >
              Color
              <PixelPetArt
                petType={pet.pet_type}
                color={resolvedColorId(pet.color, pet.pet_type)}
                className="accessory-slot-art"
                alt=""
              />
            </button>
            <button
              type="button"
              className="accessory-slot"
              aria-label={`Hat: ${accessoryDisplayName("hat", pet.hat)}`}
              onClick={() => setPicker("hat")}
            >
              Hat
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="accessory-slot-art"
                src={accessoryIconSrc("hat", pet.hat)}
                alt=""
                draggable={false}
              />
            </button>
            <button
              type="button"
              className="accessory-slot"
              aria-label={`Clothes: ${accessoryDisplayName("clothes", pet.clothes)}`}
              onClick={() => setPicker("clothes")}
            >
              Clothes
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="accessory-slot-art"
                src={accessoryIconSrc("clothes", pet.clothes)}
                alt=""
                draggable={false}
              />
            </button>
          </div>
          <p className="panel-hint">
            Rename coupons: {renameCoupons}
          </p>
          {renaming ? (
            <form className="pet-rename-form" onSubmit={onRename}>
              <label className="field">
                <span>New name</span>
                <input
                  type="text"
                  value={draftName}
                  maxLength={RENAME_PET_NAME_MAX}
                  autoFocus
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </label>
              <div className="tracker-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={pending}
                  onClick={() => {
                    setRenaming(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="button" disabled={pending || renameCoupons < 1}>
                  Save name
                </button>
              </div>
            </form>
          ) : (
            <div className="tracker-actions">
              <button
                type="button"
                className="button button-ghost"
                disabled={pending || renameCoupons < 1}
                onClick={startRename}
              >
                Rename
              </button>
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
          )}
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

function PetColorPicker({
  pet,
  ownedColorIds,
  onClose,
  onApplied,
}: {
  pet: PetCard;
  ownedColorIds: readonly string[];
  onClose: () => void;
  onApplied: (colorId: string) => void;
}) {
  const ownedColors = SAMPLE_COLORS.filter((color) => ownedColorIds.includes(color.id));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onChoose(colorId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(colorId);
    const result = await applyPetColor(pet.id, colorId);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onApplied(colorId);
  }

  return (
    <FarmDialog title="Color" onClose={onClose} wide>
      <p className="panel-hint">Choose a color for {petDisplayName(pet)}.</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {ownedColors.length === 0 ? (
        <p className="collection-empty-title">You don&apos;t own any colors yet.</p>
      ) : (
        <ul className="collection-color-grid">
          {ownedColors.map((color) => {
            const selected = pet.color === color.id;
            return (
              <li key={color.id}>
                <button
                  type="button"
                  className={selected ? "collection-color is-selected" : "collection-color"}
                  aria-pressed={selected}
                  disabled={pendingId !== null}
                  onClick={() => onChoose(color.id)}
                >
                  <PixelPetArt petType={pet.pet_type} color={color.id} hat={pet.hat} clothes={pet.clothes} className="dialog-pet-art" />
                  <strong>{pendingId === color.id ? "…" : color.name}</strong>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </FarmDialog>
  );
}

function PetAccessoryPicker({
  pet,
  kind,
  ownedIds,
  selectedId,
  onClose,
  onApplied,
}: {
  pet: PetCard;
  kind: "hat" | "clothes";
  ownedIds: readonly string[];
  selectedId: string | null;
  onClose: () => void;
  onApplied: (id: string | null) => void;
}) {
  const previewItems = ownedPreviewRewards(kind, ownedIds);
  const legacyItems =
    kind === "hat"
      ? SAMPLE_HATS.filter((hat) => ownedIds.includes(hat.id))
      : SAMPLE_CLOTHES.filter((item) => ownedIds.includes(item.id));
  const hasOwned = previewItems.length > 0 || legacyItems.length > 0;
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = kind === "hat" ? "Hat" : "Clothes";
  const emptyTitle = kind === "hat" ? "You don't own any hats yet." : "You don't own any clothes yet.";

  async function onChoose(id: string | null) {
    if (pendingKey) return;
    setError(null);
    setPendingKey(id ?? "none");
    const result = kind === "hat" ? await applyPetHat(pet.id, id) : await applyPetClothes(pet.id, id);
    setPendingKey(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onApplied(id);
  }

  return (
    <FarmDialog title={title} onClose={onClose} wide>
      <p className="panel-hint">
        Choose {kind === "hat" ? "a hat" : "clothes"} for {petDisplayName(pet)}.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!hasOwned ? <p className="collection-empty-title">{emptyTitle}</p> : null}
      <ul className="collection-color-grid collection-accessory-grid">
        <li>
          <button
            type="button"
            className={selectedId === null ? "collection-color is-selected" : "collection-color"}
            aria-pressed={selectedId === null}
            disabled={pendingKey !== null}
            onClick={() => onChoose(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="collection-accessory-art"
              src={COLLECTION_NONE.icon}
              alt=""
              draggable={false}
              style={{ imageRendering: "pixelated" }}
            />
            <strong>{pendingKey === "none" ? "…" : COLLECTION_NONE.name}</strong>
          </button>
        </li>
        {previewItems.map((item: PreviewReward) => {
          const selected = selectedId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={selected ? "collection-color is-selected" : "collection-color"}
                aria-pressed={selected}
                disabled={pendingKey !== null}
                onClick={() => onChoose(item.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="collection-accessory-art"
                  src={item.icon}
                  alt=""
                  draggable={false}
                  style={{ imageRendering: "pixelated" }}
                />
                <strong>{pendingKey === item.id ? "…" : item.name}</strong>
              </button>
            </li>
          );
        })}
        {legacyItems.map((item) => {
          const selected = selectedId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={selected ? "collection-color is-selected" : "collection-color"}
                aria-pressed={selected}
                disabled={pendingKey !== null}
                onClick={() => onChoose(item.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="collection-accessory-art"
                  src={item.icon}
                  alt=""
                  draggable={false}
                  style={{ imageRendering: "pixelated" }}
                />
                <strong>{pendingKey === item.id ? "…" : item.name}</strong>
              </button>
            </li>
          );
        })}
      </ul>
    </FarmDialog>
  );
}
