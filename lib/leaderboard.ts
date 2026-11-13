import { formatDuration } from "./study";

export const LEADERBOARD_MODES = [
  { id: "all_time", label: "Cumulative study time between friends" },
  { id: "month", label: "Study time this month between friends" },
  { id: "week", label: "Study time this week between friends" },
  { id: "pet_levels", label: "Total levels of pets owned between friends" },
] as const;

export type LeaderboardMode = (typeof LEADERBOARD_MODES)[number]["id"];

export type LeaderboardRow = {
  farmerId: string;
  displayName: string;
  score: number;
  place: number;
};

const LEADERBOARD_MIGRATION = "Run migration 0027 before opening the leaderboard.";

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

export function leaderboardMessage(message: string) {
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
