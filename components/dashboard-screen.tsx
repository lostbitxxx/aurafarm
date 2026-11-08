import Link from "next/link";
import { GodotFrame } from "./godot-frame";
import { PetStatus } from "./pet-status";
import { SiteHeader } from "./site-header";
import { StudyPanel } from "./study-panel";
import { describePet, type PetCard } from "@/lib/pets";
import type { ActiveStudySession, BlocklistEntry, StudyScoreCard } from "@/lib/study";

export function DashboardScreen({
  displayName,
  points,
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
  points: number;
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
  const equippedName = activePet ? describePet(activePet.pet_type).name : "No pet is equipped.";
  return (
    <>
      <SiteHeader displayName={displayName} points={points} />
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
          <section className="pet-status" aria-label="Equipped pet">
            <div className="inventory-heading">
              <h2>Equipped</h2>
              <p>{petsError ?? equippedName}</p>
            </div>
            <Link href="/inventory" className="button">
              Inventory
            </Link>
          </section>
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
