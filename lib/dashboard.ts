import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isAnyDeviceFresh } from "./pet-device";
import type { PetCard } from "./pets";
import type { ActiveStudySession, BlocklistEntry, StudyScoreCard } from "./study";
import { createClient } from "./supabase/server";

export async function loadDashboard() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");

  const [{ data: profile }, petsResult, blocklistResult, sessionResult, scoresResult, devicesResult] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      supabase
        .from("user_pets")
        .select("id, pet_type, level, is_desktop_active")
        .eq("user_id", userId)
        .order("id", { ascending: true }),
      supabase.from("blocklist_hosts").select("host, label").order("host", { ascending: true }),
      supabase
        .from("study_sessions")
        .select("id, started_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("study_scores")
        .select("id, points, distracted, duration_seconds, blocked_hosts, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("pet_devices").select("last_seen_at").eq("user_id", userId),
    ]);

  const pets: PetCard[] = (petsResult.data ?? []).map((pet) => ({
    id: String(pet.id),
    pet_type: String(pet.pet_type),
    level: Number(pet.level),
    is_desktop_active: Boolean(pet.is_desktop_active),
  }));

  const blocklist: BlocklistEntry[] = (blocklistResult.data ?? []).map((entry) => ({
    host: String(entry.host),
    label: String(entry.label),
  }));

  const activeSession: ActiveStudySession | null = sessionResult.data
    ? {
        id: String(sessionResult.data.id),
        startedAt: String(sessionResult.data.started_at),
      }
    : null;

  const scores: StudyScoreCard[] = (scoresResult.data ?? []).map((score) => ({
    id: String(score.id),
    points: Number(score.points),
    distracted: Boolean(score.distracted),
    durationSeconds: Number(score.duration_seconds),
    blockedHosts: Array.isArray(score.blocked_hosts) ? score.blocked_hosts.map(String) : [],
    createdAt: String(score.created_at),
  }));

  const studyError =
    blocklistResult.error?.message ??
    sessionResult.error?.message ??
    scoresResult.error?.message ??
    null;

  return {
    displayName: profile?.display_name?.trim() || "Farmer",
    pets,
    petsError: petsResult.error?.message ?? null,
    blocklist,
    activeSession,
    scores,
    studyError,
    petRunning: isAnyDeviceFresh(
      (devicesResult.data ?? []).map((device) =>
        device.last_seen_at ? String(device.last_seen_at) : null,
      ),
      Date.now(),
    ),
    petError: presenceMessage(devicesResult.error?.message ?? null),
  };
}

function presenceMessage(message: string | null) {
  if (!message) return null;
  if (/pet_devices|schema cache/i.test(message)) {
    return "Run migration 0006 before pairing a pet.";
  }
  return message;
}
