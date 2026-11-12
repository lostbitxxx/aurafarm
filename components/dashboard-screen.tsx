"use client";

import { useEffect, useMemo, useState } from "react";
import { StudyPanel } from "./study-panel";
import { SiteHeader } from "./site-header";
import { AchievementsDialog, CollectionDialog, InventoryDialog, ShopDialog } from "./dashboard-dialogs";
import { describePet, equippedPet, type PetCard } from "@/lib/pets";
import { experienceProgress, type ActiveStudySession, type RecordedStudySession, type StudyScoreCard } from "@/lib/study";

function roomStorageKey(userId: string) {
  return `aurafarm.room.${userId}`;
}

function readRoomPlacement(userId: string, pets: PetCard[]) {
  const owned = new Set(pets.map((pet) => pet.id));
  const raw = localStorage.getItem(roomStorageKey(userId));
  if (raw === null) return { ids: owned, write: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ids: owned, write: true };
  }
  if (!Array.isArray(parsed)) return { ids: new Set<string>(), write: true };
  const saved = parsed.filter((id): id is string => typeof id === "string" && owned.has(id));
  return { ids: new Set(saved), write: saved.length !== parsed.length };
}

function writeRoomPlacement(userId: string, ids: Set<string>) {
  localStorage.setItem(roomStorageKey(userId), JSON.stringify([...ids]));
}

export function DashboardScreen({
  userId,
  displayName,
  totalStudySeconds,
  pets,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  petsError,
  activeSession,
  scores,
  recordedSessions,
  studyError,
  closeBlocked,
  closeBlockedError,
  downloadUrl,
}: {
  userId: string;
  displayName: string;
  totalStudySeconds: number;
  pets: PetCard[];
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  petsError: string | null;
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  recordedSessions: RecordedStudySession[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
  downloadUrl: string | null;
}) {
  const ownedTypes = useMemo(() => [...new Set(pets.map((pet) => pet.pet_type))], [pets]);
  const [dialog, setDialog] = useState<"shop" | "collection" | "inventory" | "achievements" | null>(null);
  const [placedIds, setPlacedIds] = useState<Set<string>>(() => new Set());
  const [placementReady, setPlacementReady] = useState(false);
  const [localPets, setLocalPets] = useState(pets);
  const petsSignature = pets
    .map((pet) => `${pet.id}:${pet.xp}:${pet.is_desktop_active}:${pet.color ?? ""}:${pet.hat ?? ""}:${pet.clothes ?? ""}`)
    .join("|");
  const [petsSnap, setPetsSnap] = useState(petsSignature);

  if (petsSignature !== petsSnap) {
    setPetsSnap(petsSignature);
    setLocalPets(pets);
  }

  useEffect(() => {
    const placement = readRoomPlacement(userId, pets);
    if (placement.write) writeRoomPlacement(userId, placement.ids);
    setPlacedIds(placement.ids);
    setPlacementReady(true);
  }, [userId, pets]);

  const activePet = equippedPet(localPets);
  const described = activePet ? describePet(activePet.pet_type) : null;
  const progress = activePet ? experienceProgress(activePet.xp) : null;
  const sessionActive = Boolean(activeSession);

  function onToggleRoom(petId: string) {
    setPlacedIds((current) => {
      const next = new Set(current);
      if (next.has(petId)) next.delete(petId);
      else next.add(petId);
      writeRoomPlacement(userId, next);
      return next;
    });
  }

  function onColorApplied(petId: string, colorId: string) {
    setLocalPets((current) =>
      current.map((pet) => (pet.id === petId ? { ...pet, color: colorId } : pet)),
    );
  }

  function onHatApplied(petId: string, hatId: string | null) {
    setLocalPets((current) =>
      current.map((pet) => (pet.id === petId ? { ...pet, hat: hatId } : pet)),
    );
  }

  function onClothesApplied(petId: string, clothesId: string | null) {
    setLocalPets((current) =>
      current.map((pet) => (pet.id === petId ? { ...pet, clothes: clothesId } : pet)),
    );
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
        onOpenShop={() => setDialog("shop")}
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
        placementReady={placementReady}
        onOpenInventory={() => setDialog("inventory")}
        onEquipped={onEquipped}
      />
      {dialog === "shop" ? <ShopDialog ownedTypes={ownedTypes} onClose={() => setDialog(null)} /> : null}
      {dialog === "collection" ? (
        <CollectionDialog
          pets={localPets}
          ownedColorIds={ownedColorIds}
          ownedHatIds={ownedHatIds}
          ownedClothesIds={ownedClothesIds}
          onClose={() => setDialog(null)}
          onColorApplied={onColorApplied}
          onHatApplied={onHatApplied}
          onClothesApplied={onClothesApplied}
        />
      ) : null}
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
