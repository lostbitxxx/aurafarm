import { HEARTBEAT_INTERVAL_MS } from "@/lib/pet-device";
import { GodotFrame } from "./godot-frame";
import { PetInventory } from "./pet-inventory";
import { PetStatus } from "./pet-status";
import { SiteHeader } from "./site-header";
import { StudyPanel } from "./study-panel";
import type { PetCard } from "@/lib/pets";
import type { ActiveStudySession, BlocklistEntry, StudyScoreCard } from "@/lib/study";

export function DashboardScreen({
  displayName,
  pets,
  petsError,
  blocklist,
  activeSession,
  scores,
  studyError,
  petRunning,
  petError,
  downloadUrl,
}: {
  displayName: string;
  pets: PetCard[];
  petsError: string | null;
  blocklist: BlocklistEntry[];
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  studyError: string | null;
  petRunning: boolean;
  petError: string | null;
  downloadUrl: string | null;
}) {
  const activePet = pets.find((pet) => pet.is_desktop_active) ?? null;
  return (
    <>
      <SiteHeader displayName={displayName} />
      <main className="desk">
        <GodotFrame
          pet={activePet ? { pet_type: activePet.pet_type, level: activePet.level } : null}
        />
        <div className="desk-side">
          <PetStatus
            downloadUrl={downloadUrl}
            running={petRunning}
            presenceError={petError}
            pollMs={HEARTBEAT_INTERVAL_MS}
          />
          <StudyPanel
            blocklist={blocklist}
            activeSession={activeSession}
            scores={scores}
            studyError={studyError}
          />
          <PetInventory pets={pets} petsError={petsError} />
        </div>
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
