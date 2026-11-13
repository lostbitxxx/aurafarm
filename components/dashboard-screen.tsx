"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { StudyPanel } from "./study-panel";
import { SiteHeader } from "./site-header";
import { LevelUpCelebration, RewardPicker } from "./level-up-reward";
import {
  AchievementsDialog,
  CollectionDialog,
  EditPlanDialog,
  InventoryDialog,
  ShopDialog,
} from "./dashboard-dialogs";
import { FriendsDialog } from "./friends-dialog";
import { type FriendCard } from "@/lib/friends";
import { describePet, equippedPet, highestPetLevel, type CollectionReward, type PetCard } from "@/lib/pets";
import { sampleClothes, sampleColor, sampleHat } from "@/lib/pet-assets";
import { parseSeenRewards, readSeenSnapshot, readServerSeenSnapshot, subscribeSeenRewards } from "@/lib/reward-seen";
import { experienceProgress, type ActiveStudySession, type RecordedStudySession, type StudyScoreCard } from "@/lib/study";
import { modeLabel, type BehaviorAnswers, type StudyMode } from "@/lib/study-mode";

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
  pendingRewards,
  petsError,
  activeSession,
  scores,
  recordedSessions,
  studyError,
  closeBlocked,
  closeBlockedError,
  downloadUrl,
  studyMode,
  preferredSessionMinutes,
  monthlySessionGoal,
  dailySessionGoal,
  studyPlan,
  friendCode,
  friends,
  friendsError,
}: {
  userId: string;
  displayName: string;
  totalStudySeconds: number;
  pets: PetCard[];
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  pendingRewards: readonly CollectionReward[];
  petsError: string | null;
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  recordedSessions: RecordedStudySession[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
  downloadUrl: string | null;
  studyMode: StudyMode | null;
  preferredSessionMinutes: number | null;
  monthlySessionGoal: number | null;
  dailySessionGoal: number | null;
  studyPlan: {
    mode: StudyMode;
    monthlySessions: number;
    answers: BehaviorAnswers | null;
  } | null;
  friendCode: string;
  friends: readonly FriendCard[];
  friendsError: string | null;
}) {
  const ownedTypes = useMemo(() => [...new Set(pets.map((pet) => pet.pet_type))], [pets]);
  const [dialog, setDialog] = useState<
    "shop" | "collection" | "inventory" | "achievements" | "edit-plan" | "friends" | null
  >(null);
  const [placedIds, setPlacedIds] = useState<Set<string>>(() => new Set());
  const [placementReady, setPlacementReady] = useState(false);
  const [localPets, setLocalPets] = useState(pets);
  const [ownedColors, setOwnedColors] = useState(ownedColorIds);
  const [ownedHats, setOwnedHats] = useState(ownedHatIds);
  const [ownedClothes, setOwnedClothes] = useState(ownedClothesIds);
  const [rewards, setRewards] = useState(pendingRewards);
  const [display, setDisplay] = useState<{ id: string; markIds: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTotal, setPickerTotal] = useState(0);
  const farmerLevel = highestPetLevel(localPets.map((pet) => pet.level));
  const petsSignature = pets
    .map((pet) => `${pet.id}:${pet.xp}:${pet.is_desktop_active}:${pet.color ?? ""}:${pet.hat ?? ""}:${pet.clothes ?? ""}`)
    .join("|");
  const ownedSignature = `${ownedColorIds.join(",")}|${ownedHatIds.join(",")}|${ownedClothesIds.join(",")}`;
  const rewardSignature = pendingRewards.map((reward) => reward.id).join("|");
  const [petsSnap, setPetsSnap] = useState(petsSignature);
  const [ownedSnap, setOwnedSnap] = useState(ownedSignature);
  const [rewardSnap, setRewardSnap] = useState(rewardSignature);

  if (petsSignature !== petsSnap) {
    setPetsSnap(petsSignature);
    setLocalPets(pets);
  }

  if (ownedSignature !== ownedSnap) {
    setOwnedSnap(ownedSignature);
    setOwnedColors(ownedColorIds);
    setOwnedHats(ownedHatIds);
    setOwnedClothes(ownedClothesIds);
  }

  if (rewardSignature !== rewardSnap) {
    setRewardSnap(rewardSignature);
    setRewards(pendingRewards);
  }

  useEffect(() => {
    const placement = readRoomPlacement(userId, pets);
    if (placement.write) writeRoomPlacement(userId, placement.ids);
    setPlacedIds(placement.ids);
    setPlacementReady(true);
  }, [userId, pets]);

  const seenRaw = useSyncExternalStore(
    subscribeSeenRewards,
    () => readSeenSnapshot(userId),
    readServerSeenSnapshot,
  );
  const seenIds = useMemo(() => parseSeenRewards(seenRaw), [seenRaw]);
  const unseen = rewards.filter((reward) => !seenIds.has(reward.id));
  const featured = unseen.reduce<CollectionReward | null>((best, reward) => {
    if (!best || reward.levelReached >= best.levelReached) return reward;
    return best;
  }, null);
  const seenReady = seenRaw !== null;

  if (display && !rewards.some((reward) => reward.id === display.id)) {
    setDisplay(null);
  } else if (seenReady && !pickerOpen && featured && display === null) {
    setDisplay({ id: featured.id, markIds: unseen.map((reward) => reward.id).join("|") });
  }

  const celebration = display ? rewards.find((reward) => reward.id === display.id) ?? null : null;

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

  const openRewardPicker = useCallback(() => {
    if (rewards.length === 0) return;
    setPickerTotal(rewards.length);
    setPickerOpen(true);
    setDisplay(null);
    setDialog(null);
  }, [rewards.length]);

  const dismissCelebration = useCallback(() => setDisplay(null), []);

  function onRewardClaimed(itemId: string) {
    const color = sampleColor(itemId);
    const hat = sampleHat(itemId);
    const clothes = sampleClothes(itemId);
    if (color) setOwnedColors((current) => (current.includes(color) ? current : [...current, color]));
    if (hat) setOwnedHats((current) => (current.includes(hat) ? current : [...current, hat]));
    if (clothes) setOwnedClothes((current) => (current.includes(clothes) ? current : [...current, clothes]));
    setRewards((current) => current.slice(1));
    if (rewards.length <= 1) setPickerOpen(false);
  }

  const celebrationPet = celebration
    ? localPets.find((pet) => pet.id === celebration.petId) ?? {
        id: celebration.petId,
        pet_type: "baby_slime",
        level: celebration.levelReached,
        xp: 0,
        is_desktop_active: false,
        color: null,
        hat: null,
        clothes: null,
      }
    : null;

  return (
    <div className="desk-page">
      <SiteHeader
        displayName={displayName}
        studySeconds={totalStudySeconds}
        onOpenShop={() => setDialog("shop")}
        onOpenCollection={() => setDialog("collection")}
        onOpenInventory={() => setDialog("inventory")}
        onOpenAchievements={() => setDialog("achievements")}
        onOpenFriends={() => setDialog("friends")}
      />
      {studyMode && monthlySessionGoal && dailySessionGoal && preferredSessionMinutes ? (
        <section className="plan-banner" aria-label="Study plan">
          <p>
            <strong>{modeLabel(studyMode)}</strong> study mode · {dailySessionGoal}×
            {preferredSessionMinutes} min today · {monthlySessionGoal} sessions this month
          </p>
          <button type="button" className="plan-edit" onClick={() => setDialog("edit-plan")}>
            Edit plan
          </button>
        </section>
      ) : null}
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
        preferredSessionMinutes={preferredSessionMinutes}
        onOpenInventory={() => setDialog("inventory")}
        onEquipped={onEquipped}
      />
      {dialog === "shop" ? (
        <ShopDialog ownedTypes={ownedTypes} farmerLevel={farmerLevel} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "collection" ? (
        <CollectionDialog
          pets={localPets}
          ownedColorIds={ownedColors}
          ownedHatIds={ownedHats}
          ownedClothesIds={ownedClothes}
          rewardCount={rewards.length}
          onChooseReward={openRewardPicker}
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
      {dialog === "friends" ? (
        <FriendsDialog
          friendCode={friendCode}
          friends={friends}
          friendsError={friendsError}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "edit-plan" && studyPlan ? (
        <EditPlanDialog
          displayName={displayName}
          initialPlan={studyPlan}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {celebration && celebrationPet && display ? (
        <LevelUpCelebration
          reward={celebration}
          pet={celebrationPet}
          userId={userId}
          markIds={display.markIds}
          onContinue={openRewardPicker}
          onDismiss={dismissCelebration}
        />
      ) : null}
      {pickerOpen ? (
        <RewardPicker
          choiceNumber={Math.max(1, pickerTotal - rewards.length + 1)}
          choiceTotal={Math.max(pickerTotal, rewards.length)}
          ownedColorIds={ownedColors}
          ownedHatIds={ownedHats}
          ownedClothesIds={ownedClothes}
          onClaimed={onRewardClaimed}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
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
