"use client";

import { useState, type ReactNode } from "react";
import { buyPet, equipPetToDesktop } from "@/lib/actions/pets";
import { EQUIP_DURING_SESSION_NOTE } from "@/lib/pet-assets";
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

/** Read-only Collection modal. No accessory catalog/unlock data exists yet. */
export function CollectionDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<CollectionTab>("colors");
  const active = COLLECTION_TABS.find((entry) => entry.id === tab) ?? COLLECTION_TABS[0];

  return (
    <FarmDialog title="Collection" onClose={onClose} wide>
      <p className="panel-hint">Your companion’s wardrobe, collected through study.</p>
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
        <p className="collection-empty-title">Nothing to collect here yet.</p>
        <p className="panel-hint">More {active.emptyNoun} are coming soon.</p>
      </div>
    </FarmDialog>
  );
}

export type InventorySort = "name-asc" | "name-desc" | "level-asc" | "level-desc";

const INVENTORY_SORT_OPTIONS: { value: InventorySort; label: string }[] = [
  { value: "name-asc", label: "Name: A–Z" },
  { value: "name-desc", label: "Name: Z–A" },
  { value: "level-asc", label: "Level: Low–High" },
  { value: "level-desc", label: "Level: High–Low" },
];

function comparePetId(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortInventoryPets(pets: readonly PetCard[], sort: InventorySort) {
  const rows = pets.map((pet) => ({
    pet,
    name: describePet(pet.pet_type).name,
  }));

  rows.sort((left, right) => {
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    const byId = comparePetId(left.pet.id, right.pet.id);

    if (sort === "name-asc") return byName || byId;
    if (sort === "name-desc") return -byName || byId;
    if (sort === "level-asc") {
      return left.pet.level - right.pet.level || byName || byId;
    }
    return right.pet.level - left.pet.level || byName || byId;
  });

  return rows.map((row) => row.pet);
}

export function InventoryDialog({
  pets,
  placedIds,
  sessionActive,
  sort,
  onSortChange,
  onClose,
  onToggleRoom,
  onEquipped,
}: {
  pets: PetCard[];
  placedIds: ReadonlySet<string>;
  sessionActive: boolean;
  sort: InventorySort;
  onSortChange: (sort: InventorySort) => void;
  onClose: () => void;
  onToggleRoom: (petId: string) => void;
  onEquipped?: (petId: string) => void;
}) {
  const [items, setItems] = useState(pets);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const petsSignature = pets.map((pet) => `${pet.id}:${pet.level}:${pet.xp}:${pet.is_desktop_active}`).join("|");
  const [snapshot, setSnapshot] = useState(petsSignature);

  if (petsSignature !== snapshot) {
    setSnapshot(petsSignature);
    setItems(pets);
  }

  const sorted = sortInventoryPets(items, sort);
  const countLabel = items.length === 1 ? "1 pet" : `${items.length} pets`;

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
    <FarmDialog
      title="Inventory"
      onClose={onClose}
      wide
      cardClassName="inventory-dialog"
      headerExtra={
        <label className="inventory-sort">
          <span className="inventory-sort-label">Sort</span>
          <select
            value={sort}
            aria-label="Sort pets"
            onChange={(event) => onSortChange(event.target.value as InventorySort)}
          >
            {INVENTORY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <p className="inventory-count">{countLabel}</p>
      {sessionActive ? <p className="panel-hint">End your session to switch companions.</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {sorted.length === 0 ? (
        <p className="inventory-empty">No pets yet.</p>
      ) : (
        <ul className="inventory-list">
          {sorted.map((pet) => {
            const copy = describePet(pet.pet_type);
            const inRoom = placedIds.has(pet.id);
            const equipBlocked = sessionActive || pendingId !== null || pet.is_desktop_active;
            return (
              <li key={pet.id} className="dialog-row inventory-row">
                <PixelPetArt petType={pet.pet_type} className="dialog-pet-art" />
                <div className="inventory-row-copy">
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
                    {pet.is_desktop_active ? "Equipped" : "Equip"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="panel-hint inventory-room-note">Room selections reset on reload.</p>
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
