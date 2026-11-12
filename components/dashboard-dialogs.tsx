"use client";

import { useState, type ReactNode } from "react";
import { applyPetClothes, applyPetColor, applyPetHat, buyPet, equipPetToDesktop } from "@/lib/actions/pets";
import { EQUIP_DURING_SESSION_NOTE, ROOM_PLACEMENT_NOTE, SAMPLE_CLOTHES, SAMPLE_COLORS, SAMPLE_HATS } from "@/lib/pet-assets";
import { describePet, shopCatalog, shopPurchaseBlock, type PetCard, type ShopPet } from "@/lib/pets";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

export function ShopDialog({
  ownedTypes,
  onClose,
}: {
  ownedTypes: string[];
  onClose: () => void;
}) {
  const catalog = shopCatalog();
  const [owned, setOwned] = useState(ownedTypes);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onBuy(pet: ShopPet) {
    if (pending) return;
    const blocked = shopPurchaseBlock(pet.pet_type, owned);
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
      <p className="panel-hint">Take a pet home. The starter Baby Slime is not for sale.</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="dialog-list">
        {catalog.map((pet) => {
          const isOwned = owned.includes(pet.pet_type);
          return (
            <li key={pet.pet_type} className="dialog-row">
              <PixelPetArt petType={pet.pet_type} className="dialog-pet-art" />
              <div>
                <strong>{pet.name}</strong>
                <p className="panel-hint">{pet.note}</p>
              </div>
              {isOwned ? (
                <span className="equipped-flag">Owned</span>
              ) : (
                <button
                  type="button"
                  className="button button-small"
                  disabled={pending !== null}
                  onClick={() => onBuy(pet)}
                >
                  {pending === pet.pet_type ? "…" : "Buy"}
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

const COLLECTION_TABS: { id: CollectionTab; label: string; emptyNoun: string }[] = [
  { id: "colors", label: "Colors", emptyNoun: "colors" },
  { id: "hats", label: "Hats", emptyNoun: "hats" },
  { id: "clothes", label: "Clothes", emptyNoun: "clothes" },
];

export function CollectionDialog({
  pets,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  onClose,
  onColorApplied,
  onHatApplied,
  onClothesApplied,
}: {
  pets: PetCard[];
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
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
  const ownedHats = SAMPLE_HATS.filter((hat) => ownedHatIds.includes(hat.id));
  const ownedClothes = SAMPLE_CLOTHES.filter((clothes) => ownedClothesIds.includes(clothes.id));
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

  return (
    <FarmDialog title="Collection" onClose={onClose} wide>
      <p className="panel-hint">A color you own can be applied to any pet.</p>
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
      <div
        className="collection-panel"
        role="tabpanel"
        id={`collection-panel-${active.id}`}
        aria-labelledby={`collection-tab-${active.id}`}
      >
        {tab === "colors" && ownedColors.length > 0 ? (
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
        ) : tab === "hats" && ownedHats.length > 0 ? (
          <ul className="collection-color-grid">
            <li>
              <button type="button" className="collection-color" onClick={() => setApplyHat({ id: null })}>
                <PixelPetArt petType="baby_slime" className="dialog-pet-art" />
                <strong>None</strong>
              </button>
            </li>
            {ownedHats.map((hat) => (
              <li key={hat.id}>
                <button type="button" className="collection-color" onClick={() => setApplyHat({ id: hat.id })}>
                  <PixelPetArt petType="baby_slime" hat={hat.id} className="dialog-pet-art" />
                  <strong>{hat.id}</strong>
                </button>
              </li>
            ))}
          </ul>
        ) : tab === "clothes" && ownedClothes.length > 0 ? (
          <ul className="collection-color-grid">
            <li>
              <button type="button" className="collection-color" onClick={() => setApplyClothes({ id: null })}>
                <PixelPetArt petType="baby_slime" className="dialog-pet-art" />
                <strong>None</strong>
              </button>
            </li>
            {ownedClothes.map((clothes) => (
              <li key={clothes.id}>
                <button
                  type="button"
                  className="collection-color"
                  onClick={() => setApplyClothes({ id: clothes.id })}
                >
                  <PixelPetArt petType="baby_slime" clothes={clothes.id} className="dialog-pet-art" />
                  <strong>{clothes.id}</strong>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="collection-empty-title">Nothing to collect here yet.</p>
            <p className="panel-hint">More {active.emptyNoun} are coming soon.</p>
          </>
        )}
      </div>
    </FarmDialog>
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
  const label = hatId ?? "no hat";

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
    <FarmDialog title={hatId ? `Apply ${hatId}` : "Remove hat"} onClose={onClose} wide>
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
  const label = clothesId ?? "no clothes";

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
    <FarmDialog title={clothesId ? `Apply ${clothesId}` : "Remove clothes"} onClose={onClose} wide>
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

export function AchievementsDialog({ onClose }: { onClose: () => void }) {
  return (
    <FarmDialog title="Achievements" onClose={onClose}>
      <p>Coming soon!</p>
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
