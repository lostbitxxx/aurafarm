import { GodotFrame } from "./godot-frame";
import { PetInventory } from "./pet-inventory";
import { SiteHeader } from "./site-header";
import type { PetCard } from "@/lib/pets";

export function DashboardScreen({
  displayName,
  pets,
  petsError,
}: {
  displayName: string;
  pets: PetCard[];
  petsError: string | null;
}) {
  return (
    <>
      <SiteHeader displayName={displayName} />
      <main className="desk">
        <GodotFrame />
        <PetInventory pets={pets} petsError={petsError} />
      </main>
    </>
  );
}

export function DashboardFallback() {
  return (
    <>
      <header className="topbar">
        <span className="wordmark">Aurafarm</span>
      </header>
      <main className="desk" aria-busy="true">
        <section className="monitor" aria-hidden="true">
          <div className="skeleton skeleton-frame" />
        </section>
        <section className="inventory">
          <p>Opening your desk…</p>
        </section>
      </main>
    </>
  );
}
