import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { sampleColor } from "./pet-assets";
import { wholePoints, type PetCard } from "./pets";
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
import { createClient } from "./supabase/server";

export async function loadDashboard() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");

  const [
    { data: profile },
    closeBlockedResult,
    petsResult,
    collectionsResult,
    sessionResult,
    scoresResult,
    recordedResult,
  ] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      supabase.from("profiles").select("close_blocked").eq("id", userId).maybeSingle(),
      supabase
        .from("user_pets")
        .select("id, pet_type, level, xp, is_desktop_active, color")
        .eq("user_id", userId)
        .order("id", { ascending: true }),
      supabase.from("user_collections").select("item_id").eq("user_id", userId),
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
        .select("id, status, duration_seconds, ended_at")
        .eq("user_id", userId)
        .in("status", ["submitted", "cancelled"])
        .not("duration_seconds", "is", null)
        .order("ended_at", { ascending: false }),
    ]);

  const pets: PetCard[] = (petsResult.data ?? []).map((pet) => {
    const xp = wholePoints(pet.xp);
    return {
      id: String(pet.id),
      pet_type: String(pet.pet_type),
      level: levelFromExperience(xp),
      xp,
      is_desktop_active: Boolean(pet.is_desktop_active),
      color: sampleColor(pet.color),
    };
  });

  const ownedColorIds = (collectionsResult.data ?? []).flatMap((row) => {
    const color = sampleColor(row.item_id);
    return color ? [color] : [];
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
    return [
      {
        id: String(session.id),
        status: session.status,
        durationSeconds,
        endedAt: String(session.ended_at ?? ""),
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
    sessionResult.error?.message ??
      scoresResult.error?.message ??
      recordedResult.error?.message ??
      petsResult.error?.message ??
      collectionsResult.error?.message ??
      null,
  );

  return {
    userId,
    displayName: profile?.display_name?.trim() || "Farmer",
    totalStudySeconds,
    pets,
    ownedColorIds,
    petsError: studyTimerMigrationMessage(
      collectionsResult.error?.message ?? petsResult.error?.message ?? null,
    ),
    activeSession,
    scores,
    recordedSessions: recordedSessions.slice(0, 10),
    studyError,
    closeBlocked: closeBlockedResult.data?.close_blocked === true,
    closeBlockedError: closeBlockedMigrationMessage(closeBlockedResult.error?.message ?? null),
  };
}
