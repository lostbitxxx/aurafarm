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
  closeBlocked,
  closeBlockedError,
  downloadUrl,
}: {
  displayName: string;
  pets: PetCard[];
  petsError: string | null;
  blocklist: BlocklistEntry[];
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
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
          <PetStatus downloadUrl={downloadUrl} />
          <StudyPanel
            blocklist={blocklist}
            activeSession={activeSession}
            scores={scores}
            studyError={studyError}
            closeBlocked={closeBlocked}
            closeBlockedError={closeBlockedError}
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
      <header className="hud">
        <span className="wordmark">Aurafarm</span>
        <div className="hud-stat" aria-hidden="true" />
      </header>
      <main className="desk" aria-busy="true">
        <section className="viewport monitor" aria-hidden="true">
          <div className="skeleton skeleton-frame" />
        </section>
        <section className="panel inventory">
          <p>Opening your desk…</p>
        </section>
      </main>
    </>
  );
}
