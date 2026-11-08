import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { labelForBlockedHost } from "./blocklist";
import { wholePoints } from "./pets";
import { createClient } from "./supabase/server";

const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ScoreState = {
  displayName: string;
  balance: number;
};

export type LoadedStudyScore =
  | (ScoreState & { state: "missing" })
  | (ScoreState & { state: "pending" })
  | (ScoreState & { state: "cancelled" })
  | (ScoreState & {
      state: "scored";
      points: number;
      distracted: boolean;
      durationSeconds: number;
      blockedLabels: string[];
      createdAt: string;
    });

export async function loadStudyScore(sessionId: string): Promise<LoadedStudyScore> {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, points")
    .eq("id", userId)
    .maybeSingle();
  const displayName = profile?.display_name?.trim() || "Farmer";
  const balance = wholePoints(profile?.points);

  if (!sessionIdPattern.test(sessionId)) return { displayName, balance, state: "missing" };

  const [sessionResult, scoreResult, blocklistResult] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("status")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("study_scores")
      .select("points, distracted, duration_seconds, blocked_hosts, created_at")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("blocklist_hosts").select("host, label"),
  ]);

  if (!sessionResult.data) return { displayName, balance, state: "missing" };

  const entries = (blocklistResult.data ?? []).map((entry) => ({
    host: String(entry.host),
    label: String(entry.label),
  }));

  if (scoreResult.data) {
    const hosts = Array.isArray(scoreResult.data.blocked_hosts)
      ? scoreResult.data.blocked_hosts.map(String)
      : [];
    return {
      displayName,
      balance,
      state: "scored",
      points: Number(scoreResult.data.points),
      distracted: Boolean(scoreResult.data.distracted),
      durationSeconds: Number(scoreResult.data.duration_seconds),
      blockedLabels: hosts.map((host) => labelForBlockedHost(host, entries)),
      createdAt: String(scoreResult.data.created_at),
    };
  }

  if (sessionResult.data.status === "cancelled") return { displayName, balance, state: "cancelled" };
  return { displayName, balance, state: "pending" };
}
