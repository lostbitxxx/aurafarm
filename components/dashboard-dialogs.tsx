"use client";

import { useState, type ReactNode } from "react";
import { buyPet, equipPetToDesktop } from "@/lib/actions/pets";
import { EQUIP_DURING_SESSION_NOTE, ROOM_PLACEMENT_NOTE } from "@/lib/pet-assets";
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
              <PixelPetArt petType={pet.pet_type} className="dialog-pet-art" />
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
