"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  COLLECTION_ACCESSORY_HINT,
  COLLECTION_COLOR_HINT,
  collectionComingSoonMessage,
  collectionCountLabel,
  collectionNoneCard,
  collectionProgress,
  ownedPreviewRewards,
  previewReward,
  type CollectionKind,
  type PreviewReward,
} from "@/lib/collection-catalog";
import { applyPetClothes, applyPetColor, applyPetHat, buyPet, equipPetToDesktop } from "@/lib/actions/pets";
import {
  EQUIP_DURING_SESSION_NOTE,
  ROOM_PLACEMENT_NOTE,
  sampleAccessoryName,
  SAMPLE_CLOTHES,
  SAMPLE_COLORS,
  SAMPLE_HATS,
} from "@/lib/pet-assets";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { describePet, shopCatalog, shopPurchaseBlock, type PetCard, type ShopPet } from "@/lib/pets";
import type { BehaviorAnswers, StudyMode } from "@/lib/study-mode";
import { CustomizeWizard } from "./customize-wizard";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

export function ShopDialog({
  ownedTypes,
  farmerLevel,
  onClose,
}: {
  ownedTypes: string[];
  farmerLevel: number;
  onClose: () => void;
}) {
  const catalog = shopCatalog();
  const [owned, setOwned] = useState(ownedTypes);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onUnlock(pet: ShopPet) {
    if (pending) return;
    const blocked = shopPurchaseBlock(pet.pet_type, owned, farmerLevel);
    if (blocked) {
      setError(blocked);
      return;
    }
    const previous = owned;
    setOwned((current) => [...current, pet.pet_type]);
    setError(null);
    setPending(pet.pet_type);
    const result = await buyPet(pet.pet_type);
    setPending(null);
    if (result.error) {
      setOwned(previous);
      setError(result.error);
    }
  }

  return (
    <FarmDialog title="Shop" onClose={onClose} wide>
      <p className="panel-hint">Every two levels unlocks the next pet.</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="dialog-list">
        {catalog.map((pet) => {
          const isOwned = owned.includes(pet.pet_type);
          const locked = farmerLevel < pet.unlockLevel;
          return (
            <li key={pet.pet_type} className="dialog-row">
              <PixelPetArt petType={pet.pet_type} className="dialog-pet-art" />
              <div>
                <strong>{pet.name}</strong>
                <p className="panel-hint">{pet.note}</p>
              </div>
              {isOwned ? (
                <span className="equipped-flag">Owned</span>
              ) : locked ? (
                <span className="shop-lock">Unlocks at level {pet.unlockLevel}</span>
              ) : (
                <button
                  type="button"
                  className="button button-small"
                  disabled={pending !== null}
                  onClick={() => onUnlock(pet)}
                >
                  {pending === pet.pet_type ? "…" : "Unlock"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </FarmDialog>
  );
}

type CollectionTab = "colors" | "hats" | "clothes";

const COLLECTION_TABS: { id: CollectionTab; label: string; kind: CollectionKind }[] = [
  { id: "colors", label: "Colors", kind: "color" },
  { id: "hats", label: "Hats", kind: "hat" },
  { id: "clothes", label: "Clothes", kind: "clothes" },
];

const COLLECTION_NONE = collectionNoneCard();

export function CollectionDialog({
  pets,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  rewardCount,
  onChooseReward,
  onClose,
  onColorApplied,
  onHatApplied,
  onClothesApplied,
}: {
  pets: PetCard[];
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  rewardCount: number;
  onChooseReward: () => void;
  onClose: () => void;
  onColorApplied: (petId: string, colorId: string) => void;
  onHatApplied: (petId: string, hatId: string | null) => void;
  onClothesApplied: (petId: string, clothesId: string | null) => void;
}) {
  const [tab, setTab] = useState<CollectionTab>("colors");
  const [applyColorId, setApplyColorId] = useState<string | null>(null);
  const [applyHat, setApplyHat] = useState<{ id: string | null } | null>(null);
  const [applyClothes, setApplyClothes] = useState<{ id: string | null } | null>(null);
  const active = COLLECTION_TABS.find((entry) => entry.id === tab) ?? COLLECTION_TABS[0];
  const ownedColors = SAMPLE_COLORS.filter((color) => ownedColorIds.includes(color.id));
  const ownedPreviewHats = ownedPreviewRewards("hat", ownedHatIds);
  const ownedPreviewClothes = ownedPreviewRewards("clothes", ownedClothesIds);
  const ownedLegacyHats = SAMPLE_HATS.filter((hat) => ownedHatIds.includes(hat.id));
  const ownedLegacyClothes = SAMPLE_CLOTHES.filter((item) => ownedClothesIds.includes(item.id));
  const applyColor = ownedColors.find((color) => color.id === applyColorId) ?? null;

  if (applyColor) {
    return (
      <ApplyColorDialog
        colorId={applyColor.id}
        colorName={applyColor.name}
        pets={pets}
        onClose={() => setApplyColorId(null)}
        onApplied={onColorApplied}
      />
    );
  }

  if (applyHat) {
    return (
      <ApplyHatDialog
        hatId={applyHat.id}
        pets={pets}
        onClose={() => setApplyHat(null)}
        onApplied={onHatApplied}
      />
    );
  }

  if (applyClothes) {
    return (
      <ApplyClothesDialog
        clothesId={applyClothes.id}
        pets={pets}
        onClose={() => setApplyClothes(null)}
        onApplied={onClothesApplied}
      />
    );
  }

  const accessoryHint =
    tab === "colors" ? (
      <p className="panel-hint">{COLLECTION_COLOR_HINT}</p>
    ) : (
      <p className="panel-hint">{COLLECTION_ACCESSORY_HINT}</p>
    );
  const ownedIdsForTab =
    active.kind === "color" ? ownedColorIds : active.kind === "hat" ? ownedHatIds : ownedClothesIds;
  const progress = collectionProgress(active.kind, ownedIdsForTab);
  const equippedPet = pets.find((pet) => pet.is_desktop_active) ?? null;

  return (
    <FarmDialog title="Collection" onClose={onClose} wide>
      {accessoryHint}
      {rewardCount > 0 ? (
        <p className="collection-reward-entry">
          <button type="button" className="button button-small" onClick={onChooseReward}>
            {rewardCount === 1 ? "Choose a reward" : `Choose a reward (${rewardCount})`}
          </button>
        </p>
      ) : null}
      <div className="collection-toolbar">
        <div className="collection-tabs" role="tablist" aria-label="Collection categories">
          {COLLECTION_TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`collection-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls={`collection-panel-${entry.id}`}
              className={tab === entry.id ? "button button-small" : "button button-small button-ghost"}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {progress ? (
          <p className="collection-count" aria-label={collectionCountLabel(active.kind, progress.owned, progress.total)}>
            {progress.owned}/{progress.total}
          </p>
        ) : (
          <p className="collection-count" aria-label="Collection count unavailable">
            Collection count unavailable
          </p>
        )}
      </div>
      <div
        className="collection-panel"
        role="tabpanel"
        id={`collection-panel-${active.id}`}
        aria-labelledby={`collection-tab-${active.id}`}
      >
        {tab === "colors" ? (
          <>
            {ownedColors.length > 0 ? (
              <ul className="collection-color-grid">
                {ownedColors.map((color) => (
                  <li key={color.id}>
                    <button type="button" className="collection-color" onClick={() => setApplyColorId(color.id)}>
                      <PixelPetArt petType="baby_slime" color={color.id} className="dialog-pet-art" />
                      <strong>{color.name}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="collection-empty-title">Nothing to collect here yet.</p>
            )}
            <p className="collection-coming-soon">{collectionComingSoonMessage("color")}</p>
          </>
        ) : tab === "hats" ? (
          <OwnedAccessoryPanel
            previewItems={ownedPreviewHats}
            legacyItems={ownedLegacyHats}
            legacyKind="hat"
            noneSelected={equippedPet ? equippedPet.hat === null : false}
            onApply={(id) => setApplyHat({ id })}
            onSelectNone={() => setApplyHat({ id: null })}
          />
        ) : (
          <OwnedAccessoryPanel
            previewItems={ownedPreviewClothes}
            legacyItems={ownedLegacyClothes}
            legacyKind="clothes"
            noneSelected={equippedPet ? equippedPet.clothes === null : false}
            onApply={(id) => setApplyClothes({ id })}
            onSelectNone={() => setApplyClothes({ id: null })}
          />
        )}
      </div>
    </FarmDialog>
  );
}

function OwnedAccessoryPanel({
  previewItems,
  legacyItems,
  legacyKind,
  noneSelected,
  onApply,
  onSelectNone,
}: {
  previewItems: readonly PreviewReward[];
  legacyItems: readonly { id: string; name: string }[];
  legacyKind: "hat" | "clothes";
  noneSelected: boolean;
  onApply: (id: string) => void;
  onSelectNone: () => void;
}) {
  const hasOwned = previewItems.length > 0 || legacyItems.length > 0;
  const emptyTitle = legacyKind === "hat" ? "You don't own any hats yet." : "You don't own any clothes yet.";

  return (
    <>
      {!hasOwned ? <p className="collection-empty-title">{emptyTitle}</p> : null}
      <ul className="collection-color-grid collection-accessory-grid">
        <li>
          <button
            type="button"
            className={noneSelected ? "collection-color is-selected" : "collection-color"}
            aria-pressed={noneSelected}
            onClick={onSelectNone}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="collection-accessory-art"
              src={COLLECTION_NONE.icon}
              alt=""
              draggable={false}
              style={{ imageRendering: "pixelated" }}
            />
            <strong>{COLLECTION_NONE.name}</strong>
          </button>
        </li>
        {previewItems.map((item) => (
          <li key={item.id}>
            <button type="button" className="collection-color" onClick={() => onApply(item.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="collection-accessory-art"
                src={item.icon}
                alt=""
                draggable={false}
                style={{ imageRendering: "pixelated" }}
              />
              <strong>{item.name}</strong>
            </button>
          </li>
        ))}
        {legacyItems.map((item) => (
          <li key={item.id}>
            <button type="button" className="collection-color" onClick={() => onApply(item.id)}>
              <PixelPetArt
                petType="baby_slime"
                hat={legacyKind === "hat" ? item.id : null}
                clothes={legacyKind === "clothes" ? item.id : null}
                className="dialog-pet-art"
                alt=""
              />
              <strong>{item.name}</strong>
            </button>
          </li>
        ))}
      </ul>
      <p className="collection-coming-soon">{collectionComingSoonMessage(legacyKind)}</p>
    </>
  );
}

function ApplyColorDialog({
  colorId,
  colorName,
  pets,
  onClose,
  onApplied,
}: {
  colorId: string;
  colorName: string;
  pets: PetCard[];
  onClose: () => void;
  onApplied: (petId: string, colorId: string) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onApply(petId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(petId);
    const result = await applyPetColor(petId, colorId);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onApplied(petId, colorId);
    onClose();
  }

  return (
    <FarmDialog title={`Apply ${colorName}`} onClose={onClose} wide>
      <p className="panel-hint">Which pet should wear {colorName}?</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {pets.length === 0 ? (
        <p className="panel-hint">You do not own a pet yet.</p>
      ) : (
        <ul className="dialog-list">
          {pets.map((pet) => {
            const copy = describePet(pet.pet_type);
            return (
              <li key={pet.id} className="dialog-row">
                <PixelPetArt petType={pet.pet_type} color={pet.color} hat={pet.hat} clothes={pet.clothes} className="dialog-pet-art" />
                <div>
                  <strong>{copy.name}</strong>
                  <p className="panel-hint">Level {pet.level}</p>
                </div>
                <button
                  type="button"
                  className="button button-small"
                  disabled={pendingId !== null}
                  onClick={() => onApply(pet.id)}
                >
                  {pendingId === pet.id ? "…" : "Apply"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </FarmDialog>
  );
}

function ApplyHatDialog({
  hatId,
  pets,
  onClose,
  onApplied,
}: {
  hatId: string | null;
  pets: PetCard[];
  onClose: () => void;
  onApplied: (petId: string, hatId: string | null) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = (hatId ? previewReward(hatId)?.name ?? sampleAccessoryName("hat", hatId) : null) ?? hatId ?? "no hat";

  async function onApply(petId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(petId);
    const result = await applyPetHat(petId, hatId);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onApplied(petId, hatId);
    onClose();
  }

  return (
    <FarmDialog title={hatId ? `Apply ${label}` : "Remove hat"} onClose={onClose} wide>
      <p className="panel-hint">Which pet should wear {label}?</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {pets.length === 0 ? (
        <p className="panel-hint">You do not own a pet yet.</p>
      ) : (
        <ul className="dialog-list">
          {pets.map((pet) => {
            const copy = describePet(pet.pet_type);
            return (
              <li key={pet.id} className="dialog-row">
                <PixelPetArt petType={pet.pet_type} color={pet.color} hat={pet.hat} clothes={pet.clothes} className="dialog-pet-art" />
                <div>
                  <strong>{copy.name}</strong>
                  <p className="panel-hint">Level {pet.level}</p>
                </div>
                <button
                  type="button"
                  className="button button-small"
                  disabled={pendingId !== null}
                  onClick={() => onApply(pet.id)}
                >
                  {pendingId === pet.id ? "…" : hatId ? "Apply" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </FarmDialog>
  );
}

function ApplyClothesDialog({
  clothesId,
  pets,
  onClose,
  onApplied,
}: {
  clothesId: string | null;
  pets: PetCard[];
  onClose: () => void;
  onApplied: (petId: string, clothesId: string | null) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label =
    (clothesId ? previewReward(clothesId)?.name ?? sampleAccessoryName("clothes", clothesId) : null) ??
    clothesId ??
    "no clothes";

  async function onApply(petId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(petId);
    const result = await applyPetClothes(petId, clothesId);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    onApplied(petId, clothesId);
    onClose();
  }

  return (
    <FarmDialog title={clothesId ? `Apply ${label}` : "Remove clothes"} onClose={onClose} wide>
      <p className="panel-hint">Which pet should wear {label}?</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {pets.length === 0 ? (
        <p className="panel-hint">You do not own a pet yet.</p>
      ) : (
        <ul className="dialog-list">
          {pets.map((pet) => {
            const copy = describePet(pet.pet_type);
            return (
              <li key={pet.id} className="dialog-row">
                <PixelPetArt
                  petType={pet.pet_type}
                  color={pet.color}
                  hat={pet.hat}
                  clothes={pet.clothes}
                  className="dialog-pet-art"
                />
                <div>
                  <strong>{copy.name}</strong>
                  <p className="panel-hint">Level {pet.level}</p>
                </div>
                <button
                  type="button"
                  className="button button-small"
                  disabled={pendingId !== null}
                  onClick={() => onApply(pet.id)}
                >
                  {pendingId === pet.id ? "…" : clothesId ? "Apply" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </FarmDialog>
  );
}

export function InventoryDialog({
  pets,
  placedIds,
  sessionActive,
  onClose,
  onToggleRoom,
  onEquipped,
}: {
  pets: PetCard[];
  placedIds: ReadonlySet<string>;
  sessionActive: boolean;
  onClose: () => void;
  onToggleRoom: (petId: string) => void;
  onEquipped?: (petId: string) => void;
}) {
  const [items, setItems] = useState(pets);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onEquip(petId: string) {
    if (pendingId || sessionActive) return;
    const previous = items;
    setItems((current) => current.map((pet) => ({ ...pet, is_desktop_active: pet.id === petId })));
    setError(null);
    setPendingId(petId);
    const result = await equipPetToDesktop(petId);
    setPendingId(null);
    if (result.error) {
      setItems(previous);
      setError(result.error);
      return;
    }
    onEquipped?.(petId);
  }

  return (
    <FarmDialog title="Inventory" onClose={onClose} wide>
      <p className="panel-hint">Equip chooses the desktop companion. Room placement is separate.</p>
      <p className="panel-hint">{ROOM_PLACEMENT_NOTE}</p>
      {sessionActive ? <p className="panel-hint">{EQUIP_DURING_SESSION_NOTE}</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="dialog-list">
        {items.map((pet) => {
          const copy = describePet(pet.pet_type);
          const inRoom = placedIds.has(pet.id);
          const equipBlocked = sessionActive || pendingId !== null || pet.is_desktop_active;
          return (
            <li key={pet.id} className="dialog-row">
              <PixelPetArt petType={pet.pet_type} color={pet.color} hat={pet.hat} clothes={pet.clothes} className="dialog-pet-art" />
              <div>
                <strong>{copy.name}</strong>
                <p className="panel-hint">
                  Level {pet.level}
                  {pet.is_desktop_active ? " · Equipped" : ""}
                </p>
              </div>
              <div className="dialog-row-actions">
                <button type="button" className="button button-small button-ghost" onClick={() => onToggleRoom(pet.id)}>
                  {inRoom ? "Remove from room" : "Show in room"}
                </button>
                <button
                  type="button"
                  className={pet.is_desktop_active ? "button button-small" : "button button-small button-ghost"}
                  disabled={equipBlocked}
                  title={sessionActive && !pet.is_desktop_active ? EQUIP_DURING_SESSION_NOTE : undefined}
                  onClick={() => onEquip(pet.id)}
                >
                  {pet.is_desktop_active ? "Equipped" : sessionActive ? "Locked" : "Equip"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </FarmDialog>
  );
}

export function AchievementsDialog({
  earnedIds,
  error,
  onClose,
}: {
  earnedIds: readonly string[];
  error: string | null;
  onClose: () => void;
}) {
  const earned = new Set(earnedIds);
  return (
    <FarmDialog title="Achievements" onClose={onClose}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="dialog-list achievement-list">
        {ACHIEVEMENTS.map((achievement) => {
          const done = earned.has(achievement.id);
          return (
            <li
              key={achievement.id}
              className={done ? "achievement-row achievement-row-earned" : "achievement-row achievement-row-locked"}
            >
              <div>
                <strong>{achievement.title}</strong>
                {done ? <span className="achievement-earned">Earned</span> : null}
                <p className="panel-hint">{achievement.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </FarmDialog>
  );
}

export function EditPlanDialog({
  displayName,
  initialPlan,
  onClose,
}: {
  displayName: string;
  initialPlan: {
    mode: StudyMode;
    monthlySessions: number;
    answers: BehaviorAnswers | null;
  };
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <FarmDialog title="Edit study plan" onClose={onClose} wide>
      <CustomizeWizard
        displayName={displayName}
        migrationError={null}
        initialPlan={initialPlan}
        embedded
        onSaved={() => {
          onClose();
          router.refresh();
        }}
      />
    </FarmDialog>
  );
}

export function HistoryDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <FarmDialog title={title} onClose={onClose} wide>
      {children}
    </FarmDialog>
  );
}
