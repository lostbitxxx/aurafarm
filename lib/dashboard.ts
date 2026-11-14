import "server-only";
import { connection } from "next/server";
import { achievementsMigrationMessage, earnedAchievementIds } from "./achievements";
import { previewReward } from "./collection-catalog";
import { requireCustomizationComplete } from "./customization";
import { sampleClothes, sampleColor, sampleHat } from "./pet-assets";
import { wholePoints, type CollectionReward, type PetCard } from "./pets";
import {
  closeBlockedMigrationMessage,
  DEFAULT_STUDY_SECONDS,
  levelFromExperience,
  storedStudySeconds,
  studyTimerMigrationMessage,
  type ActiveStudySession,
  type RecordedStudySession,
  type StudyScoreCard,
} from "./study";
import {
  isStudyMode,
  parseBehaviorAnswers,
  type BehaviorAnswers,
  type StudyMode,
} from "./study-mode";
import { createClient } from "./supabase/server";

export async function loadDashboard() {
  await connection();
  const gate = await requireCustomizationComplete();
  const supabase = await createClient();
  const userId = gate.userId;

  const { error: evaluateError } = await supabase.rpc("evaluate_achievements");

  const [
    profileResult,
    closeBlockedResult,
    petsResult,
    collectionsResult,
    rewardsResult,
    sessionResult,
    scoresResult,
    recordedResult,
    achievementsResult,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, behavior_answers, streak_count, streak_local_date",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("close_blocked").eq("id", userId).maybeSingle(),
      supabase
        .from("user_pets")
        .select("id, pet_type, level, xp, is_desktop_active, color, hat, clothes")
        .eq("user_id", userId)
        .order("id", { ascending: true }),
      supabase.from("user_collections").select("item_id").eq("user_id", userId),
      supabase
        .from("collection_rewards")
        .select("id, pet_id, level_reached")
        .eq("user_id", userId)
        .is("item_id", null)
        .order("level_reached", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("study_sessions")
        .select("id, started_at, planned_seconds, use_desktop_pet")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("study_sessions")
        .select("id, xp_awarded, blocked_count, duration_seconds, blocked_hosts, ended_at")
        .eq("user_id", userId)
        .eq("status", "submitted")
        .order("ended_at", { ascending: false })
        .limit(10),
      supabase
        .from("study_sessions")
        .select("id, status, duration_seconds, ended_at, xp_awarded, use_desktop_pet")
        .eq("user_id", userId)
        .in("status", ["submitted", "cancelled"])
        .not("duration_seconds", "is", null)
        .order("ended_at", { ascending: false }),
      evaluateError
        ? Promise.resolve({ data: null, error: evaluateError })
        : supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
    ]);

  const profile = profileResult.data;
  const studyMode: StudyMode | null = isStudyMode(profile?.study_mode) ? profile.study_mode : null;
  const behaviorAnswers: BehaviorAnswers | null = parseBehaviorAnswers(profile?.behavior_answers);

  function wornItem(value: unknown, kind: "hat" | "clothes") {
    const legacy = kind === "hat" ? sampleHat(value) : sampleClothes(value);
    if (legacy) return legacy;
    const preview = typeof value === "string" ? previewReward(value) : null;
    return preview?.kind === kind ? preview.id : null;
  }

  const pets: PetCard[] = (petsResult.data ?? []).map((pet) => {
    const xp = wholePoints(pet.xp);
    return {
      id: String(pet.id),
      pet_type: String(pet.pet_type),
      level: levelFromExperience(xp),
      xp,
      is_desktop_active: Boolean(pet.is_desktop_active),
      color: sampleColor(pet.color),
      hat: wornItem(pet.hat, "hat"),
      clothes: wornItem(pet.clothes, "clothes"),
    };
  });

  const ownedColorIds = (collectionsResult.data ?? []).flatMap((row) => {
    const color = sampleColor(row.item_id);
    return color ? [color] : [];
  });
  const ownedHatIds = (collectionsResult.data ?? []).flatMap((row) => {
    const hat = sampleHat(row.item_id);
    if (hat) return [hat];
    const preview = previewReward(String(row.item_id));
    return preview?.kind === "hat" ? [preview.id] : [];
  });
  const ownedClothesIds = (collectionsResult.data ?? []).flatMap((row) => {
    const clothes = sampleClothes(row.item_id);
    if (clothes) return [clothes];
    const preview = previewReward(String(row.item_id));
    return preview?.kind === "clothes" ? [preview.id] : [];
  });

  const pendingRewards: CollectionReward[] = (rewardsResult.data ?? []).flatMap((row) => {
    const levelReached = Number(row.level_reached);
    if (!Number.isInteger(levelReached) || levelReached < 2) return [];
    return [
      {
        id: String(row.id),
        petId: String(row.pet_id),
        levelReached,
      },
    ];
  });

  const activeSession: ActiveStudySession | null = sessionResult.data
    ? {
        id: String(sessionResult.data.id),
        startedAt: String(sessionResult.data.started_at),
        plannedSeconds:
          storedStudySeconds(Number(sessionResult.data.planned_seconds)) ?? DEFAULT_STUDY_SECONDS,
        useDesktopPet: sessionResult.data.use_desktop_pet === true,
      }
    : null;

  const recordedSessions: RecordedStudySession[] = (recordedResult.data ?? []).flatMap((session) => {
    if (session.status !== "submitted" && session.status !== "cancelled") return [];
    const durationSeconds = Number(session.duration_seconds);
    if (!Number.isFinite(durationSeconds)) return [];
    const xpRaw = session.xp_awarded;
    const xpAwarded =
      xpRaw === null || xpRaw === undefined
        ? null
        : Number.isFinite(Number(xpRaw))
          ? Math.max(0, Math.trunc(Number(xpRaw)))
          : null;
    const modeRaw = session.use_desktop_pet;
    const useDesktopPet =
      modeRaw === true ? true : modeRaw === false ? false : null;
    return [
      {
        id: String(session.id),
        status: session.status,
        durationSeconds,
        endedAt: String(session.ended_at ?? ""),
        xpAwarded,
        useDesktopPet,
      },
    ];
  });
  const totalStudySeconds = recordedSessions.reduce((sum, session) => sum + session.durationSeconds, 0);

  const scores: StudyScoreCard[] = (scoresResult.data ?? []).map((score) => ({
    id: String(score.id),
    xp: Number(score.xp_awarded ?? 0),
    distracted: Number(score.blocked_count) > 0,
    durationSeconds: Number(score.duration_seconds),
    blockedHosts: Array.isArray(score.blocked_hosts) ? score.blocked_hosts.map(String) : [],
    createdAt: String(score.ended_at ?? ""),
  }));

  const studyError = studyTimerMigrationMessage(
    rewardsResult.error?.message ??
      sessionResult.error?.message ??
      scoresResult.error?.message ??
      recordedResult.error?.message ??
      petsResult.error?.message ??
      collectionsResult.error?.message ??
      profileResult.error?.message ??
      null,
  );

  const streakCount = Number.isFinite(Number(profile?.streak_count))
    ? Math.max(0, Math.floor(Number(profile?.streak_count)))
    : 0;
  const streakLocalDate =
    typeof profile?.streak_local_date === "string" ? profile.streak_local_date : null;

  const earnedAchievements = earnedAchievementIds(
    (achievementsResult.data ?? []).map((row) => row.achievement_id),
  );
  const achievementsError = achievementsMigrationMessage(
    evaluateError?.message ?? achievementsResult.error?.message ?? null,
  );

  return {
    userId,
    displayName: profile?.display_name?.trim() || gate.displayName || "Farmer",
    totalStudySeconds,
    streakCount,
    streakLocalDate,
    pets,
    ownedColorIds,
    ownedHatIds,
    ownedClothesIds,
    earnedAchievements,
    achievementsError,
    pendingRewards,
    petsError: studyTimerMigrationMessage(
      rewardsResult.error?.message ??
        collectionsResult.error?.message ??
        petsResult.error?.message ??
        null,
    ),
    activeSession,
    scores,
    recordedSessions: recordedSessions.slice(0, 10),
    studyError,
    closeBlocked: closeBlockedResult.data?.close_blocked === true,
    closeBlockedError: closeBlockedMigrationMessage(closeBlockedResult.error?.message ?? null),
    studyMode,
    preferredSessionMinutes: Number(profile?.preferred_session_minutes ?? 0) || null,
    monthlySessionGoal: Number(profile?.monthly_session_goal ?? 0) || null,
    dailySessionGoal: Number(profile?.daily_session_goal ?? 0) || null,
    studyPlan:
      studyMode && Number(profile?.monthly_session_goal ?? 0) > 0
        ? {
            mode: studyMode,
            monthlySessions: Number(profile?.monthly_session_goal ?? 1),
            answers: behaviorAnswers,
          }
        : null,
  };
}
