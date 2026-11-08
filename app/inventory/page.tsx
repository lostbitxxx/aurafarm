import type { Metadata } from "next";
import { PetInventory } from "@/components/pet-inventory";
import { SiteHeader } from "@/components/site-header";
import { loadInventory } from "@/lib/inventory";

export const metadata: Metadata = {
  title: "Inventory",
};

export const instant = false;

export default async function InventoryPage() {
  const inventory = await loadInventory();
  return (
    <>
      <SiteHeader displayName={inventory.displayName} points={inventory.points} />
      <main className="shop-layout">
        <PetInventory pets={inventory.pets} petsError={inventory.petsError} />
      </main>
    </>
  );
}
