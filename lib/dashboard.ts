import "server-only";
import { connection } from "next/server";
import { achievementsMigrationMessage, earnedAchievementIds } from "./achievements";
import { previewReward } from "./collection-catalog";
import { requireCustomizationComplete } from "./customization";
import { sampleClothes, sampleColor, sampleHat } from "./pet-assets";
import { wholePoints, type CollectionReward, type PetCard } from "./pets";
import { clampRenameCoupons } from "./rename-coupon";
import { SONGS, songById, type OwnedSong } from "./songs";
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
  defaultWeekdaysForLifestyle,
  isStudyMode,
  resolveWeekSchedule,
  restWeekdaysFor,
  parseBehaviorAnswers,
  type BehaviorAnswers,
  type StudyMode,
  type Weekday,
} from "./study-mode";
import { createClient } from "./supabase/server";

type DashboardProfile = {
  display_name?: string | null;
  study_mode?: unknown;
  preferred_session_minutes?: unknown;
  behavior_answers?: unknown;
  streak_count?: unknown;
  streak_local_date?: unknown;
  weekly_study_days?: unknown;
  weekly_rest_days?: unknown;
  rename_coupons?: unknown;
  show_pet_names?: unknown;
  coins?: unknown;
};

function dashboardProfile(value: unknown): DashboardProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("display_name" in value)) return null;
  return value as DashboardProfile;
}

export async function loadDashboard() {
  await connection();
  const gate = await requireCustomizationComplete();
  const supabase = await createClient();
  const userId = gate.userId;

  const { error: evaluateError } = await supabase.rpc("evaluate_achievements");

  const PROFILE_SELECT_WITH_WEEKLY =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, weekly_study_days, weekly_rest_days, behavior_answers, streak_count, streak_local_date, rename_coupons, show_pet_names, coins";
  const PROFILE_SELECT_WITH_WEEKLY_NO_REST =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, weekly_study_days, behavior_answers, streak_count, streak_local_date, rename_coupons, show_pet_names, coins";
  const PROFILE_SELECT_LEGACY =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, behavior_answers, streak_count, streak_local_date";
  const PROFILE_SELECT_WITH_RENAME =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, weekly_study_days, weekly_rest_days, behavior_answers, streak_count, streak_local_date";
  const PROFILE_SELECT_WITH_RENAME_NO_REST =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, weekly_study_days, behavior_answers, streak_count, streak_local_date";
  const PROFILE_SELECT_WITHOUT_COINS =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, weekly_study_days, weekly_rest_days, behavior_answers, streak_count, streak_local_date, rename_coupons, show_pet_names";
  const PROFILE_SELECT_WITHOUT_COINS_NO_REST =
    "display_name, study_mode, preferred_session_minutes, monthly_session_goal, daily_session_goal, weekly_study_days, behavior_answers, streak_count, streak_local_date, rename_coupons, show_pet_names";
  const [
    profileFetched,
    closeBlockedResult,
    petsResult,
    collectionsResult,
    roomSkinsResult,
    rewardsResult,
    sessionResult,
    scoresResult,
    recordedResult,
    songsResult,
    achievementsResult,
  ] = await Promise.all([
      supabase.from("profiles").select(PROFILE_SELECT_WITH_WEEKLY).eq("id", userId).maybeSingle(),
      supabase.from("profiles").select("close_blocked").eq("id", userId).maybeSingle(),
      supabase
        .from("user_pets")
        .select("id, pet_type, level, xp, is_desktop_active, color, hat, clothes, name")
        .eq("user_id", userId)
        .order("id", { ascending: true }),
      supabase.from("user_collections").select("item_id").eq("user_id", userId),
      supabase.from("user_room_skins").select("category_id, skin_id").eq("user_id", userId),
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
      supabase.from("user_songs").select("song_id, seen_at").eq("user_id", userId),
      evaluateError
        ? Promise.resolve({ data: null, error: evaluateError })
        : supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
    ]);

  let profileResultInitial = profileFetched;
  let restColumnMissing = false;
  if (
    profileResultInitial.error &&
    /weekly_rest_days/i.test(profileResultInitial.error.message) &&
    !/weekly_study_days/i.test(profileResultInitial.error.message)
  ) {
    restColumnMissing = true;
    profileResultInitial = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_WITH_WEEKLY_NO_REST)
      .eq("id", userId)
      .maybeSingle();
  }

  const coinsColumnMissing = /\bcoins\b/i.test(profileResultInitial.error?.message ?? "");
  const renameColumnsMissing = /rename_coupons|show_pet_names/i.test(
    profileResultInitial.error?.message ?? "",
  );
  const weeklyColumnMissing = /weekly_study_days/i.test(profileResultInitial.error?.message ?? "");
  const renameSelect = restColumnMissing ? PROFILE_SELECT_WITH_RENAME_NO_REST : PROFILE_SELECT_WITH_RENAME;
  const coinsFallbackSelect = restColumnMissing
    ? PROFILE_SELECT_WITHOUT_COINS_NO_REST
    : PROFILE_SELECT_WITHOUT_COINS;
  const profileResult = coinsColumnMissing
    ? renameColumnsMissing
      ? weeklyColumnMissing
        ? await supabase.from("profiles").select(PROFILE_SELECT_LEGACY).eq("id", userId).maybeSingle()
        : await supabase.from("profiles").select(renameSelect).eq("id", userId).maybeSingle()
      : weeklyColumnMissing
        ? await supabase.from("profiles").select(PROFILE_SELECT_LEGACY).eq("id", userId).maybeSingle()
        : await supabase.from("profiles").select(coinsFallbackSelect).eq("id", userId).maybeSingle()
    : renameColumnsMissing
      ? weeklyColumnMissing
        ? await supabase.from("profiles").select(PROFILE_SELECT_LEGACY).eq("id", userId).maybeSingle()
        : await supabase.from("profiles").select(renameSelect).eq("id", userId).maybeSingle()
      : weeklyColumnMissing
        ? await supabase.from("profiles").select(PROFILE_SELECT_LEGACY).eq("id", userId).maybeSingle()
        : profileResultInitial;

  const petsNameMissing = /column .*name.* does not exist|Could not find the .*name.* column/i.test(
    petsResult.error?.message ?? "",
  );
  const petsFallback = petsNameMissing
    ? await supabase
        .from("user_pets")
        .select("id, pet_type, level, xp, is_desktop_active, color, hat, clothes")
        .eq("user_id", userId)
        .order("id", { ascending: true })
    : null;
  const petsData = petsFallback?.data ?? petsResult.data;
  const petsLoadError = petsNameMissing ? petsFallback?.error?.message ?? null : petsResult.error?.message;

  const profile = dashboardProfile(profileResult.data);
  const studyMode: StudyMode | null = isStudyMode(profile?.study_mode) ? profile.study_mode : null;
  const behaviorAnswers: BehaviorAnswers | null = parseBehaviorAnswers(profile?.behavior_answers);
  const preferredMinutes = Number(profile?.preferred_session_minutes ?? 0) || null;
  const storedStudy = weeklyColumnMissing
    ? null
    : (profile as { weekly_study_days?: unknown } | null)?.weekly_study_days;
  const storedRest =
    weeklyColumnMissing || restColumnMissing
      ? null
      : (profile as { weekly_rest_days?: unknown } | null)?.weekly_rest_days;
  const schedule = resolveWeekSchedule(storedStudy, storedRest);
  const weeklyStudyDays: Weekday[] =
    schedule?.studyDays ??
    (behaviorAnswers
      ? defaultWeekdaysForLifestyle(behaviorAnswers.lifestyle)
      : studyMode && preferredMinutes
        ? defaultWeekdaysForLifestyle("steady")
        : []);
  const weeklyRestDays: Weekday[] =
    schedule?.restDays ?? (weeklyStudyDays.length > 0 ? restWeekdaysFor(weeklyStudyDays) : []);
  const planMigrationHint = weeklyColumnMissing
    ? "Run migration 0044 in the Supabase SQL editor so weekly study days can save."
    : restColumnMissing
      ? "Run migration 0052 in the Supabase SQL editor so rest days can save."
      : null;

  function wornItem(value: unknown, kind: "hat" | "clothes") {
    const legacy = kind === "hat" ? sampleHat(value) : sampleClothes(value);
    if (legacy) return legacy;
    const preview = typeof value === "string" ? previewReward(value) : null;
    return preview?.kind === kind ? preview.id : null;
  }

  const pets: PetCard[] = (petsData ?? []).map((pet) => {
    const xp = wholePoints(pet.xp);
    const customName =
      "name" in pet && typeof pet.name === "string" && pet.name.trim() ? pet.name.trim() : null;
    return {
      id: String(pet.id),
      pet_type: String(pet.pet_type),
      level: levelFromExperience(xp),
      xp,
      is_desktop_active: Boolean(pet.is_desktop_active),
      color: sampleColor(pet.color),
      hat: wornItem(pet.hat, "hat"),
      clothes: wornItem(pet.clothes, "clothes"),
      name: customName,
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

  const seenSongIds = new Map<string, boolean>();
  for (const row of songsResult.data ?? []) {
    const id = typeof row.song_id === "string" ? row.song_id : "";
    if (!songById(id)) continue;
    seenSongIds.set(id, row.seen_at != null);
  }
  const ownedSongs: OwnedSong[] = SONGS.flatMap((song) =>
    seenSongIds.has(song.id) ? [{ id: song.id, seen: seenSongIds.get(song.id) === true }] : [],
  );
  const songsError = songsResult.error
    ? /user_songs/i.test(songsResult.error.message)
      ? "Run migration 0038 before unlocking desk songs."
      : songsResult.error.message
    : null;

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
  // endedAt only — the desk counts these on the Hong Kong calendar day.
  const planSessions = recordedSessions
    .filter((session) => session.status === "submitted")
    .map((session) => ({
      status: "submitted" as const,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
    }));

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
      petsLoadError ??
      collectionsResult.error?.message ??
      (weeklyColumnMissing || restColumnMissing || renameColumnsMissing || coinsColumnMissing
        ? null
        : profileResult.error?.message) ??
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

  const renameCoupons = clampRenameCoupons((profile as { rename_coupons?: unknown } | null)?.rename_coupons);
  const showPetNames = (profile as { show_pet_names?: unknown } | null)?.show_pet_names !== false;
  const coinsRaw = (profile as { coins?: unknown } | null)?.coins;
  const coins =
    !coinsColumnMissing && Number.isFinite(Number(coinsRaw))
      ? Math.max(0, Math.trunc(Number(coinsRaw)))
      : 0;

  const roomSkinsMissing = /user_room_skins/i.test(roomSkinsResult.error?.message ?? "");
  const ownedRoomSkins = roomSkinsMissing
    ? []
    : (roomSkinsResult.data ?? []).flatMap((row) => {
        const categoryId = typeof row.category_id === "string" ? row.category_id : "";
        const skinId = typeof row.skin_id === "string" ? row.skin_id : "";
        if (!categoryId || !skinId) return [];
        return [{ categoryId, skinId }];
      });

  return {
    userId,
    displayName: profile?.display_name?.trim() || gate.displayName || "Farmer",
    totalStudySeconds,
    coins,
    streakCount,
    streakLocalDate,
    pets,
    renameCoupons,
    showPetNames,
    ownedColorIds,
    ownedHatIds,
    ownedClothesIds,
    ownedRoomSkins,
    ownedSongs,
    songsError,
    earnedAchievements,
    achievementsError,
    pendingRewards,
    petsError: studyTimerMigrationMessage(
      rewardsResult.error?.message ??
        collectionsResult.error?.message ??
        petsLoadError ??
        null,
    ),
    activeSession,
    scores,
    recordedSessions: recordedSessions.slice(0, 10),
    studyError,
    closeBlocked: closeBlockedResult.data?.close_blocked === true,
    closeBlockedError: closeBlockedMigrationMessage(closeBlockedResult.error?.message ?? null),
    studyMode,
    preferredSessionMinutes: preferredMinutes,
    weeklyStudyDays,
    planSessions,
    planMigrationHint,
    studyPlan: studyMode
      ? {
          mode: studyMode,
          sessionMinutes: preferredMinutes ?? 60,
          studyWeekdays:
            weeklyStudyDays.length > 0
              ? weeklyStudyDays
              : defaultWeekdaysForLifestyle(behaviorAnswers?.lifestyle ?? "steady"),
          restWeekdays:
            weeklyStudyDays.length > 0
              ? weeklyRestDays
              : restWeekdaysFor(defaultWeekdaysForLifestyle(behaviorAnswers?.lifestyle ?? "steady")),
          answers: behaviorAnswers,
        }
      : null,
  };
}
