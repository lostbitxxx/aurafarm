"use server";

import { connection } from "next/server";
import {
  isLeaderboardMode,
  leaderboardMessage,
  leaderboardRowsFromRpc,
  type LeaderboardRow,
} from "@/lib/leaderboard";
import { CREW_ID_PATTERN } from "@/lib/farm-crew";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function loadFriendLeaderboard(board: string): Promise<{ error: string; rows: LeaderboardRow[] }> {
  await connection();
  if (!isLeaderboardMode(board)) return { error: "Choose a leaderboard.", rows: [] };
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured.", rows: [] };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims.sub) {
    return { error: "Sign in to see the leaderboard.", rows: [] };
  }

  const { data, error } = await supabase.rpc("list_friend_leaderboard", { board });
  if (error) return { error: leaderboardMessage(error.message), rows: [] };
  return { error: "", rows: Array.isArray(data) ? leaderboardRowsFromRpc(data) : [] };
}

export async function loadGlobalLeaderboard(board: string): Promise<{ error: string; rows: LeaderboardRow[] }> {
  await connection();
  if (!isLeaderboardMode(board)) return { error: "Choose a leaderboard.", rows: [] };
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured.", rows: [] };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims.sub) {
    return { error: "Sign in to see the leaderboard.", rows: [] };
  }

  const { data, error } = await supabase.rpc("list_global_leaderboard", { board });
  if (error) return { error: leaderboardMessage(error.message), rows: [] };
  return { error: "", rows: Array.isArray(data) ? leaderboardRowsFromRpc(data) : [] };
}

export async function loadFarmCrewLeaderboard(
  crewId: string,
  board: string,
): Promise<{ error: string; rows: LeaderboardRow[] }> {
  await connection();
  if (!CREW_ID_PATTERN.test(crewId)) return { error: "This FarmCrew is not open to you.", rows: [] };
  if (!isLeaderboardMode(board)) return { error: "Choose a leaderboard.", rows: [] };
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured.", rows: [] };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims.sub) {
    return { error: "Sign in to see the leaderboard.", rows: [] };
  }

  const { data, error } = await supabase.rpc("list_farm_crew_leaderboard", { target: crewId, board });
  if (error) return { error: leaderboardMessage(error.message), rows: [] };
  return { error: "", rows: Array.isArray(data) ? leaderboardRowsFromRpc(data) : [] };
}
