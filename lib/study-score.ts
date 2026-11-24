import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { touchSocialPresence } from "./actions/friends";
import { createClient } from "./supabase/server";

const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ScoreState = {
  displayName: string;
};

export type LoadedStudyScore =
  | (ScoreState & { state: "missing" })
  | (ScoreState & { state: "pending" })
  | (ScoreState & { state: "cancelled" })
  | (ScoreState & {
      state: "finished";
      xp: number;
      distracted: boolean;
      durationSeconds: number;
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
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const displayName = profile?.display_name?.trim() || "Farmer";

  if (!sessionIdPattern.test(sessionId)) return { displayName, state: "missing" };

  const sessionResult = await supabase
    .from("study_sessions")
    .select("status, xp_awarded, blocked_count, duration_seconds, ended_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!sessionResult.data) return { displayName, state: "missing" };

  if (sessionResult.data.status === "submitted") {
    return {
      displayName,
      state: "finished",
      xp: Number(sessionResult.data.xp_awarded ?? 0),
      distracted: Number(sessionResult.data.blocked_count) > 0,
      durationSeconds: Number(sessionResult.data.duration_seconds ?? 0),
      createdAt: String(sessionResult.data.ended_at ?? ""),
    };
  }

  if (sessionResult.data.status === "cancelled") return { displayName, state: "cancelled" };
  return { displayName, state: "pending" };
}
