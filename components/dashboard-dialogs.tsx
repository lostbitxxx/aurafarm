"use client";

import { useState, type ReactNode } from "react";
import { equipPetToDesktop } from "@/lib/actions/pets";
import { EQUIP_DURING_SESSION_NOTE, ROOM_PLACEMENT_NOTE } from "@/lib/pet-assets";
import { describePet, type PetCard } from "@/lib/pets";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

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
