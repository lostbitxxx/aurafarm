"use client";

import { useState } from "react";
import { applyPetClothes, applyPetColor, applyPetHat, equipPetToDesktop, updateShowPetNames } from "@/lib/actions/pets";
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
import { experienceProgress } from "@/lib/study";
import { FarmDialog } from "./farm-dialog";
import { PetRenameCircleButton, PetRenameForm } from "./pet-rename-controls";
import { PixelPetArt } from "./pixel-pet";

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
  showPetNames = true,
  sessionActive,
  onClose,
  onEquipped,
  onColorApplied,
  onHatApplied,
  onClothesApplied,
  onPetRenamed,
  onShowPetNamesChange,
}: {
  pet: PetCard;
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  renameCoupons?: number;
  showPetNames?: boolean;
  sessionActive: boolean;
  onClose: () => void;
  onEquipped?: (petId: string) => void;
  onColorApplied: (petId: string, colorId: string) => void;
  onHatApplied: (petId: string, hatId: string | null) => void;
  onClothesApplied: (petId: string, clothesId: string | null) => void;
  onPetRenamed?: (petId: string, name: string) => void;
  onShowPetNamesChange?: (enabled: boolean) => void;
}) {
  const displayName = petDisplayName(pet);
  const progress = experienceProgress(pet.xp);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipped, setEquipped] = useState(pet.is_desktop_active);
  const [picker, setPicker] = useState<SlotPicker | null>(null);
  const [renaming, setRenaming] = useState(false);

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
    setRenaming(true);
  }

  async function onToggleDisplayLevel() {
    if (pending) return;
    // Display Lv on => room shows name + level; off => name only (showPetNames).
    const nextShowNames = !showPetNames;
    setPending(true);
    setError(null);
    const result = await updateShowPetNames(nextShowNames);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onShowPetNamesChange?.(nextShowNames);
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

  const displayLevelActive = !showPetNames;

  return (
    <FarmDialog
      title={
        <span className="pet-detail-dialog-title">
          <span>{displayName}</span>
          {!renaming ? (
            <PetRenameCircleButton disabled={pending || renameCoupons < 1} onClick={startRename} />
          ) : null}
        </span>
      }
      onClose={onClose}
      wide
    >
      <div className="pet-detail">
        <div className="pet-detail-stage">
          <div className="big-pet">
            <PixelPetArt petType={pet.pet_type} color={pet.color} hat={pet.hat} clothes={pet.clothes} className="big-pet-art" />
          </div>
        </div>
        <div>
          <p className="panel-kicker">Unique pet instance</p>
          <div className="pet-detail-level-row">
            <h3 className="panel-name">Lv.{progress.level}</h3>
            <button
              type="button"
              className={displayLevelActive ? "button button-small" : "button button-small button-ghost"}
              aria-pressed={displayLevelActive}
              disabled={pending}
              onClick={onToggleDisplayLevel}
            >
              Display Lv
            </button>
          </div>
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
            <PetRenameForm
              pet={pet}
              renameCoupons={renameCoupons}
              pending={pending}
              onPendingChange={setPending}
              onError={setError}
              onRenamed={(name) => {
                onPetRenamed?.(pet.id, name);
                setRenaming(false);
              }}
              onCancel={() => {
                setRenaming(false);
                setError(null);
              }}
            />
          ) : (
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
        <p className="panel-hint">No colors owned yet. Level up for collection rewards.</p>
      ) : (
        <ul className="dialog-list collection-color-grid">
          {ownedColors.map((color) => (
            <li key={color.id}>
              <button
                type="button"
                className="collection-color"
                disabled={pendingId !== null}
                onClick={() => onChoose(color.id)}
              >
                <PixelPetArt petType={pet.pet_type} color={color.id} className="collection-color-art" alt="" />
                <strong>{pendingId === color.id ? "…" : color.name}</strong>
              </button>
            </li>
          ))}
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
  const owned = ownedPreviewRewards(kind, ownedIds);
  const samples = kind === "hat" ? SAMPLE_HATS : SAMPLE_CLOTHES;
  const fallback = samples.filter((item) => ownedIds.includes(item.id));
  const items: PreviewReward[] =
    owned.length > 0
      ? owned
      : fallback.map((item) => ({
          id: item.id,
          kind,
          name: item.name,
          icon: item.icon,
        }));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = kind === "hat" ? "Hat" : "Clothes";

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
      <ul className="dialog-list collection-color-grid">
        <li>
          <button
            type="button"
            className={selectedId === null ? "collection-color is-selected" : "collection-color"}
            disabled={pendingKey !== null}
            onClick={() => onChoose(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="collection-accessory-art" src={COLLECTION_NONE.icon} alt="" draggable={false} />
            <strong>{pendingKey === "none" ? "…" : COLLECTION_NONE.name}</strong>
          </button>
        </li>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={selectedId === item.id ? "collection-color is-selected" : "collection-color"}
              disabled={pendingKey !== null}
              onClick={() => onChoose(item.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="collection-accessory-art" src={item.icon} alt="" draggable={false} />
              <strong>{pendingKey === item.id ? "…" : item.name}</strong>
            </button>
          </li>
        ))}
      </ul>
    </FarmDialog>
  );
}
