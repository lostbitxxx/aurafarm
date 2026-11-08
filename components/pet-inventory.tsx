"use client";

import { useState } from "react";
import { equipPetToDesktop } from "@/lib/actions/pets";
import { describePet, type PetCard } from "@/lib/pets";
import { SlimeMark } from "./slime-mark";

export function PetInventory({
  pets,
  petsError,
}: {
  pets: PetCard[];
  petsError: string | null;
}) {
  const signature = pets
    .map((pet) => `${pet.id}:${pet.level}:${pet.is_desktop_active}`)
    .join("|");
  const [snapshot, setSnapshot] = useState(signature);
  const [items, setItems] = useState(pets);
  const [error, setError] = useState<string | null>(petsError);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (signature !== snapshot) {
    setSnapshot(signature);
    setItems(pets);
    setError(petsError);
  }

  async function onEquip(petId: string) {
    if (pendingId) return;
    const previous = items;
    setItems((current) =>
      current.map((pet) => ({
        ...pet,
        is_desktop_active: pet.id === petId,
      })),
    );
    setError(null);
    setPendingId(petId);

    const result = await equipPetToDesktop(petId);
    setPendingId(null);
    if (result.error) {
      setItems(previous);
      setError(result.error);
    }
  }

  return (
    <section className="inventory" aria-label="Pets">
      <div className="inventory-heading">
        <h2>Pets</h2>
        <p>Equip to Desktop chooses who stands in the frame.</p>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="empty-pets">Your starter slime appears here after registration.</p>
      ) : (
        <ul className="pet-grid">
          {items.map((pet) => {
            const copy = describePet(pet.pet_type);
            return (
              <li key={pet.id} className={pet.is_desktop_active ? "pet-card is-active" : "pet-card"}>
                <SlimeMark className="slime-mark slime-mark-small" />
                <div className="pet-copy">
                  <h3>{copy.name}</h3>
                  <p>Level {pet.level}</p>
                  <p className="pet-note">{copy.note}</p>
                </div>
                <button
                  type="button"
                  className={pet.is_desktop_active ? "equip-button is-equipped" : "equip-button"}
                  aria-pressed={pet.is_desktop_active}
                  disabled={pendingId !== null}
                  onClick={() => onEquip(pet.id)}
                >
                  Equip to Desktop
                </button>
                {pet.is_desktop_active ? <span className="equipped-flag">On your desktop</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
