"use client";

import { useState } from "react";
import { buyPet } from "@/lib/actions/pets";
import { shopCatalog, shopPurchaseBlock, type ShopPet } from "@/lib/pets";
import { PetMark } from "./pet-mark";
import { SiteHeader } from "./site-header";

export function ShopScreen({
  displayName,
  points,
  ownedTypes,
  shopError,
}: {
  displayName: string;
  points: number;
  ownedTypes: string[];
  shopError: string | null;
}) {
  const catalog = shopCatalog();
  const signature = `${points}|${ownedTypes.join(",")}|${shopError ?? ""}`;
  const [snapshot, setSnapshot] = useState(signature);
  const [balance, setBalance] = useState(points);
  const [owned, setOwned] = useState(ownedTypes);
  const [error, setError] = useState<string | null>(shopError);
  const [pending, setPending] = useState<string | null>(null);

  if (signature !== snapshot) {
    setSnapshot(signature);
    setBalance(points);
    setOwned(ownedTypes);
    setError(shopError);
  }

  async function onBuy(pet: ShopPet) {
    if (pending) return;
    const blocked = shopPurchaseBlock(pet.pet_type, owned, balance);
    if (blocked) {
      setError(blocked);
      return;
    }
    const previousOwned = owned;
    const previousBalance = balance;
    setOwned((current) => [...current, pet.pet_type]);
    setBalance((current) => current - pet.price);
    setError(null);
    setPending(pet.pet_type);

    const result = await buyPet(pet.pet_type);
    setPending(null);
    if (result.error) {
      setOwned(previousOwned);
      setBalance(previousBalance);
      setError(result.error);
    }
  }

  return (
    <>
      <SiteHeader displayName={displayName} points={balance} />
      <main className="shop-layout">
        <section className="inventory" aria-label="Shop">
          <div className="inventory-heading">
            <h2>Shop</h2>
            <p>Each pet costs 100 points. The starter slime is not for sale.</p>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="pet-grid">
            {catalog.map((pet) => {
              const isOwned = owned.includes(pet.pet_type);
              const tooPoor = balance < pet.price;
              return (
                <li key={pet.pet_type} className="pet-card">
                  <PetMark petType={pet.pet_type} className="slime-mark slime-mark-small" />
                  <div className="pet-copy">
                    <h3>{pet.name}</h3>
                    <p>{pet.price} points</p>
                    <p className="pet-note">{pet.note}</p>
                  </div>
                  {isOwned ? (
                    <span className="equipped-flag">Owned</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="equip-button"
                        disabled={pending !== null || tooPoor}
                        onClick={() => onBuy(pet)}
                      >
                        Buy
                      </button>
                      {tooPoor ? <p className="pet-note">Your balance is too low.</p> : null}
                    </>
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
