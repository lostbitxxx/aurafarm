"use client";

import { useState } from "react";
import { buyPet } from "@/lib/actions/pets";
import { shopCatalog, shopPurchaseBlock, type ShopPet } from "@/lib/pets";
import { PetMark } from "./pet-mark";
import { SiteHeader } from "./site-header";

export function ShopScreen({
  displayName,
  ownedTypes,
  shopError,
}: {
  displayName: string;
  ownedTypes: string[];
  shopError: string | null;
}) {
  const catalog = shopCatalog();
  const signature = `${ownedTypes.join(",")}|${shopError ?? ""}`;
  const [snapshot, setSnapshot] = useState(signature);
  const [owned, setOwned] = useState(ownedTypes);
  const [error, setError] = useState<string | null>(shopError);
  const [pending, setPending] = useState<string | null>(null);

  if (signature !== snapshot) {
    setSnapshot(signature);
    setOwned(ownedTypes);
    setError(shopError);
  }

  async function onBuy(pet: ShopPet) {
    if (pending) return;
    const blocked = shopPurchaseBlock(pet.pet_type, owned);
    if (blocked) {
      setError(blocked);
      return;
    }
    const previousOwned = owned;
    setOwned((current) => [...current, pet.pet_type]);
    setError(null);
    setPending(pet.pet_type);

    const result = await buyPet(pet.pet_type);
    setPending(null);
    if (result.error) {
      setOwned(previousOwned);
      setError(result.error);
    }
  }

  return (
    <>
      <SiteHeader displayName={displayName} />
      <main className="shop-layout">
        <section className="inventory" aria-label="Shop">
          <div className="inventory-heading">
            <h2>Shop</h2>
            <p>Take a pet home. The starter slime is not for sale.</p>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="pet-grid">
            {catalog.map((pet) => {
              const isOwned = owned.includes(pet.pet_type);
              return (
                <li key={pet.pet_type} className="pet-card">
                  <PetMark petType={pet.pet_type} className="slime-mark slime-mark-small" />
                  <div className="pet-copy">
                    <h3>{pet.name}</h3>
                    <p className="pet-note">{pet.note}</p>
                  </div>
                  {isOwned ? (
                    <span className="equipped-flag">Owned</span>
                  ) : (
                    <button
                      type="button"
                      className="equip-button"
                      disabled={pending !== null}
                      onClick={() => onBuy(pet)}
                    >
                      Add
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
