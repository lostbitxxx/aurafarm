"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudyPanel } from "./study-panel";
import { SiteHeader } from "./site-header";
import { LevelUpCelebration, RewardPicker } from "./level-up-reward";
import { DeskSong, SongUnlockCelebration } from "./song-player";
import {
  AchievementsDialog,
  CollectionDialog,
  EditPlanDialog,
  InventoryDialog,
  ShopDialog,
} from "./dashboard-dialogs";
import { FarmCrewDialog } from "./farm-crew-dialog";
import { FriendsDialog } from "./friends-dialog";
import { LeaderboardDialog } from "./leaderboard-dialog";
import { SocialPresence } from "./social-presence";
import { SocialSettingsDialog } from "./social-settings-dialog";
import { previewReward } from "@/lib/collection-catalog";
import { incomingFriendRequests, type FriendCard, type FriendInvite, type StatusSeen } from "@/lib/friends";
import { describePet, equippedPet, highestPetLevel, type CollectionReward, type PetCard } from "@/lib/pets";
import { songById, type OwnedSong } from "@/lib/songs";
import { sampleClothes, sampleColor, sampleHat } from "@/lib/pet-assets";
import { parseSeenRewards, readSeenSnapshot, readServerSeenSnapshot, subscribeSeenRewards } from "@/lib/reward-seen";
import {
  countSessionsInLocalMonth,
  countSessionsOnLocalDay,
  displayStreakCount,
  farmerLocalDay,
  monthlyPlanEncouragement,
  monthlyPlanPercent,
  subscribeFarmerLocalDay,
  experienceProgress,
  type ActiveStudySession,
  type RecordedStudySession,
  type StudyScoreCard,
} from "@/lib/study";
import { modeLabel, type BehaviorAnswers, type StudyMode } from "@/lib/study-mode";
import { DESK_REFRESH_CHANNEL, DESK_REFRESH_TYPE } from "@/lib/desk-refresh";

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
  streakCount,
  streakLocalDate,
  pets,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  ownedSongs,
  songsError,
  earnedAchievements,
  achievementsError,
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
  planSessions,
  dailySessionGoal,
  studyPlan,
  friendCode,
  friendInvite,
  allowStatusSeen,
  friends,
  friendsError,
}: {
  userId: string;
  displayName: string;
  totalStudySeconds: number;
  streakCount: number;
  streakLocalDate: string | null;
  pets: PetCard[];
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  ownedSongs: readonly OwnedSong[];
  songsError: string | null;
  earnedAchievements: readonly string[];
  achievementsError: string | null;
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
  planSessions: readonly { status: "submitted" | "cancelled"; endedAt: string }[];
  dailySessionGoal: number | null;
  studyPlan: {
    mode: StudyMode;
    monthlySessions: number;
    answers: BehaviorAnswers | null;
  } | null;
  friendCode: string;
  friendInvite: FriendInvite;
  allowStatusSeen: StatusSeen;
  friends: readonly FriendCard[];
  friendsError: string | null;
}) {
  const ownedTypes = useMemo(() => [...new Set(pets.map((pet) => pet.pet_type))], [pets]);
  const [dialog, setDialog] = useState<
    | "shop"
    | "collection"
    | "inventory"
    | "achievements"
    | "edit-plan"
    | "friends"
    | "farmcrew"
    | "social-settings"
    | "leaderboard"
    | "song"
    | null
  >(null);
  const [placedIds, setPlacedIds] = useState<Set<string>>(() => new Set());
  const [placementReady, setPlacementReady] = useState(false);
  const [localPets, setLocalPets] = useState(pets);
  const [friendRows, setFriendRows] = useState(friends);
  const [ownedColors, setOwnedColors] = useState(ownedColorIds);
  const [ownedHats, setOwnedHats] = useState(ownedHatIds);
  const [ownedClothes, setOwnedClothes] = useState(ownedClothesIds);
  const [ownedSongRows, setOwnedSongRows] = useState(ownedSongs);
  const [songDisplay, setSongDisplay] = useState<string | null>(null);
  const [rewards, setRewards] = useState(pendingRewards);
  const [display, setDisplay] = useState<{ id: string; markIds: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTotal, setPickerTotal] = useState(0);
  // Server snapshot stays at epoch so a broken streak is never shown as live before the farmer day is known.
  const todayLocal = useSyncExternalStore(
    subscribeFarmerLocalDay,
    farmerLocalDay,
    () => "1970-01-01",
  );
  const monthlySessionsCompleted = countSessionsInLocalMonth(planSessions, todayLocal);
  const dailySessionsCompleted = countSessionsOnLocalDay(planSessions, todayLocal);
  const liveStreakCount = displayStreakCount(streakCount, streakLocalDate, todayLocal);
  const streakQualifiedToday = streakLocalDate === todayLocal && liveStreakCount > 0;
  const farmerLevel = highestPetLevel(localPets.map((pet) => pet.level));
  const petsSignature = pets
    .map((pet) => `${pet.id}:${pet.xp}:${pet.is_desktop_active}:${pet.color ?? ""}:${pet.hat ?? ""}:${pet.clothes ?? ""}`)
    .join("|");
  const ownedSignature = `${ownedColorIds.join(",")}|${ownedHatIds.join(",")}|${ownedClothesIds.join(",")}`;
  const rewardSignature = pendingRewards.map((reward) => reward.id).join("|");
  const songSignature = ownedSongs.map((song) => `${song.id}:${song.seen ? 1 : 0}`).join("|");
  const friendSignature = friends.map((friend) => `${friend.friendId}:${friend.status}:${friend.incoming}`).join("|");
  const [petsSnap, setPetsSnap] = useState(petsSignature);
  const [ownedSnap, setOwnedSnap] = useState(ownedSignature);
  const [rewardSnap, setRewardSnap] = useState(rewardSignature);
  const [songSnap, setSongSnap] = useState(songSignature);
  const [friendSnap, setFriendSnap] = useState(friendSignature);

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

  if (songSignature !== songSnap) {
    setSongSnap(songSignature);
    setOwnedSongRows(ownedSongs);
  }

  if (friendSignature !== friendSnap) {
    setFriendSnap(friendSignature);
    setFriendRows(friends);
  }

  useEffect(() => {
    const placement = readRoomPlacement(userId, pets);
    if (placement.write) writeRoomPlacement(userId, placement.ids);
    setPlacedIds(placement.ids);
    setPlacementReady(true);
  }, [userId, pets]);

  const router = useRouter();
  const [deskRefreshing, startDeskRefresh] = useTransition();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(DESK_REFRESH_CHANNEL);
    let lastRefresh = 0;
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type !== DESK_REFRESH_TYPE) return;
      const now = Date.now();
      if (now - lastRefresh < 1000) return;
      lastRefresh = now;
      startDeskRefresh(() => {
        router.refresh();
      });
    };
    return () => channel.close();
  }, [router]);

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
  const songBlocked = pickerOpen || Boolean(celebration && display);
  const unseenSong = ownedSongRows.find((song) => !song.seen) ?? null;
  if (songDisplay && !ownedSongRows.some((song) => song.id === songDisplay)) {
    setSongDisplay(null);
  } else if (!songBlocked && songDisplay === null && unseenSong) {
    setSongDisplay(unseenSong.id);
  }
  const shownSong = songDisplay ? songById(songDisplay) : null;

  const activePet = equippedPet(localPets);
  const songPet = activePet ?? localPets[0] ?? {
    id: "song",
    pet_type: "baby_slime",
    level: 1,
    xp: 0,
    is_desktop_active: false,
    color: null,
    hat: null,
    clothes: null,
  };
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

  const dismissSong = useCallback(() => {
    setSongDisplay((id) => {
      if (!id) return null;
      setOwnedSongRows((current) =>
        current.map((song) => (song.id === id ? { ...song, seen: true } : song)),
      );
      return null;
    });
  }, []);

  function onRewardClaimed(itemId: string) {
    const petId = rewards[0]?.petId;
    const color = sampleColor(itemId);
    const preview = previewReward(itemId);
    const hat = sampleHat(itemId) ?? (preview?.kind === "hat" ? preview.id : null);
    const clothes = sampleClothes(itemId) ?? (preview?.kind === "clothes" ? preview.id : null);
    if (color) setOwnedColors((current) => (current.includes(color) ? current : [...current, color]));
    if (hat) setOwnedHats((current) => (current.includes(hat) ? current : [...current, hat]));
    if (clothes) setOwnedClothes((current) => (current.includes(clothes) ? current : [...current, clothes]));
    if (petId) {
      setLocalPets((current) =>
        current.map((pet) => {
          if (pet.id !== petId) return pet;
          if (color) return { ...pet, color };
          if (hat) return { ...pet, hat };
          if (clothes) return { ...pet, clothes };
          return pet;
        }),
      );
    }
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
      <SocialPresence />
      <SiteHeader
        displayName={displayName}
        studySeconds={totalStudySeconds}
        streakCount={liveStreakCount}
        onOpenShop={() => setDialog("shop")}
        onOpenCollection={() => setDialog("collection")}
        onOpenInventory={() => setDialog("inventory")}
        onOpenAchievements={() => setDialog("achievements")}
        onOpenFriends={() => setDialog("friends")}
        onOpenFarmCrew={() => setDialog("farmcrew")}
        onOpenSocialSettings={() => setDialog("social-settings")}
        onOpenLeaderboard={() => setDialog("leaderboard")}
        onOpenSong={() => setDialog("song")}
        pendingFriendRequest={incomingFriendRequests(friendRows).length > 0}
      />
      <DeskSong
        userId={userId}
        ownedIds={ownedSongRows.map((song) => song.id)}
        featuredSongId={shownSong && !songBlocked ? shownSong.id : null}
        songsError={songsError}
        open={dialog === "song"}
        onClose={() => setDialog(null)}
      />
      {studyMode && monthlySessionGoal && dailySessionGoal && preferredSessionMinutes ? (
        <div className="plan-row">
          <section
            className={
              monthlySessionsCompleted >= monthlySessionGoal
                ? "plan-banner is-complete"
                : dailySessionsCompleted >= dailySessionGoal
                  ? "plan-banner is-daily-done"
                  : "plan-banner"
            }
            aria-label="Study plan"
          >
            <div
              className="plan-banner-track"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={monthlySessionGoal}
              aria-valuenow={Math.min(monthlySessionsCompleted, monthlySessionGoal)}
              aria-label={`Study plan progress: ${dailySessionsCompleted} of ${dailySessionGoal} sessions today, ${monthlySessionsCompleted} of ${monthlySessionGoal} this month`}
            >
              <span
                className="plan-banner-fill"
                aria-hidden="true"
                style={{
                  width: `${monthlyPlanPercent(monthlySessionsCompleted, monthlySessionGoal)}%`,
                }}
              />
            </div>
            <p className="plan-banner-copy">
              <strong>{modeLabel(studyMode)}</strong> ·{" "}
              <span className="plan-banner-count">
                {dailySessionsCompleted}/{dailySessionGoal}
              </span>{" "}
              today · {preferredSessionMinutes} min ·{" "}
              <span className="plan-banner-count">
                {monthlySessionsCompleted}/{monthlySessionGoal}
              </span>{" "}
              this month
              <span className="plan-banner-note">
                {" "}
                ·{" "}
                {monthlyPlanEncouragement(
                  monthlySessionsCompleted,
                  monthlySessionGoal,
                  dailySessionsCompleted,
                  dailySessionGoal,
                )}
              </span>
            </p>
          </section>
          <button
            type="button"
            className="button button-ghost button-small plan-edit"
            onClick={() => setDialog("edit-plan")}
          >
            Edit plan
          </button>
        </div>
      ) : null}
      <StudyPanel
        activeSession={activeSession}
        deskRefreshing={deskRefreshing}
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
        streakBoostActive={liveStreakCount > 0}
        streakQualifiedToday={streakQualifiedToday}
        ownedColorIds={ownedColors}
        ownedHatIds={ownedHats}
        ownedClothesIds={ownedClothes}
        onOpenInventory={() => setDialog("inventory")}
        onEquipped={onEquipped}
        onColorApplied={onColorApplied}
        onHatApplied={onHatApplied}
        onClothesApplied={onClothesApplied}
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
      {dialog === "achievements" ? (
        <AchievementsDialog
          earnedIds={earnedAchievements}
          error={achievementsError}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "friends" ? (
        <FriendsDialog
          friends={friends}
          friendCode={friendCode}
          friendsError={friendsError}
          onFriendsChange={setFriendRows}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "farmcrew" ? <FarmCrewDialog onClose={() => setDialog(null)} /> : null}
      {dialog === "leaderboard" ? (
        <LeaderboardDialog userId={userId} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "social-settings" ? (
        <SocialSettingsDialog
          friendCode={friendCode}
          friendInvite={friendInvite}
          allowStatusSeen={allowStatusSeen}
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
      {shownSong && !songBlocked ? (
        <SongUnlockCelebration
          key={shownSong.id}
          songTitle={shownSong.title}
          songId={shownSong.id}
          pet={songPet}
          onContinue={dismissSong}
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
      {pickerOpen && rewards[0] ? (
        <RewardPicker
          key={rewards[0].id}
          rewardId={rewards[0].id}
          userId={userId}
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
