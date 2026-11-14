import { formatDuration } from "./study";

export const LEADERBOARD_MODES = [
  { id: "all_time", label: "Cumulative Study Duration - Total" },
  { id: "month", label: "Cumulative Study Duration - This Month" },
  { id: "week", label: "Cumulative Study Duration - This Week" },
  { id: "pet_levels", label: "Total Pet Levels" },
] as const;

export type LeaderboardMode = (typeof LEADERBOARD_MODES)[number]["id"];

export type LeaderboardRow = {
  farmerId: string;
  displayName: string;
  score: number;
  place: number;
};

export const LEADERBOARD_SCOPES = [
  { id: "friends", label: "Friends" },
  { id: "global", label: "Global" },
] as const;

export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number]["id"];

const LEADERBOARD_MIGRATION = "Run migration 0027 before opening the leaderboard.";
const GLOBAL_LEADERBOARD_MIGRATION = "Run migration 0037 before opening the global leaderboard.";
const CREW_LEADERBOARD_MIGRATION = "Run migration 0041 before opening the FarmCrew leaderboard.";

export function isLeaderboardMode(value: unknown): value is LeaderboardMode {
  return LEADERBOARD_MODES.some((mode) => mode.id === value);
}

export function leaderboardValueLabel(mode: LeaderboardMode) {
  if (mode === "pet_levels") return "Levels";
  return "Study time";
}

export function formatLeaderboardScore(mode: LeaderboardMode, score: number) {
  const safe = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  if (mode === "pet_levels") return safe === 1 ? "1 level" : `${safe} levels`;
  return formatDuration(safe);
}

export function isLeaderboardScope(value: unknown): value is LeaderboardScope {
  return LEADERBOARD_SCOPES.some((scope) => scope.id === value);
}

export function leaderboardMessage(message: string) {
  if (/list_farm_crew_leaderboard/i.test(message)) return CREW_LEADERBOARD_MIGRATION;
  if (/list_global_leaderboard/i.test(message)) return GLOBAL_LEADERBOARD_MIGRATION;
  if (/list_friend_leaderboard/i.test(message)) return LEADERBOARD_MIGRATION;
  if (/choose a leaderboard/i.test(message)) return "Choose a leaderboard.";
  return message;
}

type LeaderboardRpcRow = {
  farmer_id?: unknown;
  display_name?: unknown;
  score?: unknown;
  place?: unknown;
};

export function leaderboardRowsFromRpc(rows: readonly LeaderboardRpcRow[]) {
  return rows.flatMap((row) => {
    const farmerId = typeof row.farmer_id === "string" ? row.farmer_id : "";
    const score = typeof row.score === "number" ? row.score : Number(row.score);
    const place = typeof row.place === "number" ? row.place : Number(row.place);
    if (!farmerId || !Number.isFinite(score) || !Number.isInteger(place) || place < 1) return [];
    const displayName =
      typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : "Farmer";
    return [{ farmerId, displayName, score: Math.max(0, Math.floor(score)), place }];
  });
}
