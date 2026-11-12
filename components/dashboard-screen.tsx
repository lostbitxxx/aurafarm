"use client";

import { useState } from "react";
import { StudyPanel } from "./study-panel";
import { SiteHeader } from "./site-header";
import { AchievementsDialog, CollectionDialog, InventoryDialog } from "./dashboard-dialogs";
import { describePet, equippedPet, type PetCard } from "@/lib/pets";
import { experienceProgress, type ActiveStudySession, type RecordedStudySession, type StudyScoreCard } from "@/lib/study";

export function DashboardScreen({
  displayName,
  totalStudySeconds,
  pets,
  petsError,
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
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  recordedSessions: RecordedStudySession[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
  downloadUrl: string | null;
}) {
  const [dialog, setDialog] = useState<"collection" | "inventory" | "achievements" | null>(null);
  const [placedIds, setPlacedIds] = useState(() => new Set(pets.map((pet) => pet.id)));
  const [localPets, setLocalPets] = useState(pets);
  const petsSignature = pets.map((pet) => `${pet.id}:${pet.xp}:${pet.is_desktop_active}`).join("|");
  const [petsSnap, setPetsSnap] = useState(petsSignature);

  if (petsSignature !== petsSnap) {
    setPetsSnap(petsSignature);
    setLocalPets(pets);
    setPlacedIds((current) => {
      const next = new Set<string>();
      for (const pet of pets) {
        if (current.size === 0 || current.has(pet.id)) next.add(pet.id);
      }
      if (next.size === 0) {
        for (const pet of pets) next.add(pet.id);
      }
      return next;
    });
  }

  const activePet = equippedPet(localPets);
  const described = activePet ? describePet(activePet.pet_type) : null;
  const progress = activePet ? experienceProgress(activePet.xp) : null;
  const sessionActive = Boolean(activeSession);

  function onToggleRoom(petId: string) {
    setPlacedIds((current) => {
      const next = new Set(current);
      if (next.has(petId)) next.delete(petId);
      else next.add(petId);
      return next;
    });
  }

  function onEquipped(petId: string) {
    setLocalPets((current) =>
      current.map((pet) => ({
        ...pet,
        is_desktop_active: pet.id === petId,
      })),
    );
  }

  return (
    <div className="desk-page">
      <SiteHeader
        displayName={displayName}
        studySeconds={totalStudySeconds}
        onOpenCollection={() => setDialog("collection")}
        onOpenInventory={() => setDialog("inventory")}
        onOpenAchievements={() => setDialog("achievements")}
      />
      <StudyPanel
        activeSession={activeSession}
        scores={scores}
        recordedSessions={recordedSessions}
        studyError={studyError}
        closeBlocked={closeBlocked}
        closeBlockedError={closeBlockedError}
        pets={localPets}
        petName={described?.name ?? "No pet is equipped."}
        petLevel={progress?.level ?? null}
        petXp={progress?.intoLevel ?? 0}
        petNote={petsError ?? described?.note ?? "Choose one from your inventory."}
        downloadUrl={downloadUrl}
        placedIds={placedIds}
        onOpenInventory={() => setDialog("inventory")}
        onEquipped={onEquipped}
      />
      {dialog === "collection" ? <CollectionDialog onClose={() => setDialog(null)} /> : null}
      {dialog === "inventory" ? (
        <InventoryDialog
          pets={localPets}
          placedIds={placedIds}
          sessionActive={sessionActive}
          onClose={() => setDialog(null)}
          onToggleRoom={onToggleRoom}
          onEquipped={onEquipped}
        />
      ) : null}
      {dialog === "achievements" ? <AchievementsDialog onClose={() => setDialog(null)} /> : null}
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
