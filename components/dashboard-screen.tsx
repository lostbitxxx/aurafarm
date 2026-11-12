import Link from "next/link";
import { StudyPanel } from "./study-panel";
import { SiteHeader } from "./site-header";
import { describePet, equippedPet, type PetCard } from "@/lib/pets";
import { experienceProgress, type ActiveStudySession, type BlocklistEntry, type RecordedStudySession, type StudyScoreCard } from "@/lib/study";

export function DashboardScreen({
  displayName,
  totalStudySeconds,
  pets,
  petsError,
  blocklist,
  activeSession,
  scores,
  recordedSessions,
  studyError,
  closeBlocked,
  closeBlockedError,
  downloadUrl,
}: {
  displayName: string;
  totalStudySeconds: number;
  pets: PetCard[];
  petsError: string | null;
  blocklist: BlocklistEntry[];
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  recordedSessions: RecordedStudySession[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
  downloadUrl: string | null;
}) {
  const activePet = equippedPet(pets);
  const described = activePet ? describePet(activePet.pet_type) : null;
  const progress = activePet ? experienceProgress(activePet.xp) : null;
  return (
    <div className="desk-page">
      <SiteHeader displayName={displayName} studySeconds={totalStudySeconds} />
      <StudyPanel
        blocklist={blocklist}
        activeSession={activeSession}
        scores={scores}
        recordedSessions={recordedSessions}
        studyError={studyError}
        closeBlocked={closeBlocked}
        closeBlockedError={closeBlockedError}
        pets={pets}
        petName={described?.name ?? "No pet is equipped."}
        petLevel={progress?.level ?? null}
        petXp={progress?.intoLevel ?? 0}
        petNote={petsError ?? described?.note ?? "Choose one from your inventory."}
        downloadUrl={downloadUrl}
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
          <p className="growth-label">Opening your desk…</p>
        </section>
      </main>
    </div>
  );
}
