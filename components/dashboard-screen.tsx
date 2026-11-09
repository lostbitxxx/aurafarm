import Link from "next/link";
import { GodotFrame } from "./godot-frame";
import { StudyPanel } from "./study-panel";
import { SiteHeader } from "./site-header";
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
  const described = activePet ? describePet(activePet.pet_type) : null;
  return (
    <div className="desk-page">
      <SiteHeader displayName={displayName} points={points} />
      <StudyPanel
        blocklist={blocklist}
        activeSession={activeSession}
        scores={scores}
        studyError={studyError}
        closeBlocked={closeBlocked}
        closeBlockedError={closeBlockedError}
        petName={described?.name ?? "No pet is equipped."}
        petLevel={activePet?.level ?? null}
        petNote={petsError ?? described?.note ?? "Choose one from your inventory."}
        downloadUrl={downloadUrl}
        scene={
          <GodotFrame
            pet={activePet ? { pet_type: activePet.pet_type, level: activePet.level } : null}
          />
        }
        extras={
          <Link href="/inventory" className="button button-ghost">
            Inventory
          </Link>
        }
      />
    </div>
  );
}

export function DashboardFallback() {
  return (
    <div className="desk-page">
      <header className="topbar">
        <span className="wordmark">Aurafarm</span>
      </header>
      <main className="desk" aria-busy="true">
        <section className="scene">
          <p className="scene-note">a quiet place to begin ✦</p>
          <div className="skeleton skeleton-frame" />
          <p className="growth-label">Opening your desk…</p>
        </section>
      </main>
    </div>
  );
}
