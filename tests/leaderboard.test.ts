import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  formatLeaderboardScore,
  leaderboardMessage,
  leaderboardRowsFromRpc,
  leaderboardValueLabel,
} from "../lib/leaderboard";

test("leaderboard rows keep rank, name, and score", () => {
  assert.equal(formatLeaderboardScore("all_time", 3661), "1h 1m");
  assert.equal(formatLeaderboardScore("month", 45), "45s");
  assert.equal(formatLeaderboardScore("pet_levels", 1), "1 level");
  assert.equal(formatLeaderboardScore("pet_levels", 4), "4 levels");
  assert.equal(leaderboardValueLabel("week"), "Study time");
  assert.equal(leaderboardValueLabel("pet_levels"), "Levels");
  assert.equal(
    leaderboardMessage("Could not find the function public.list_friend_leaderboard"),
    "Run migration 0027 before opening the leaderboard.",
  );
  assert.deepEqual(
    leaderboardRowsFromRpc([
      { farmer_id: "11111111-1111-4111-8111-111111111111", display_name: " Ada ", score: "120", place: 1 },
      { farmer_id: "", score: 10, place: 2 },
    ]),
    [
      {
        farmerId: "11111111-1111-4111-8111-111111111111",
        displayName: "Ada",
        score: 120,
        place: 1,
      },
    ],
  );
});

test("friend leaderboard sums study time and pet levels for accepted friends", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0027_friend_leaderboard.sql", import.meta.url),
    "utf8",
  );
  const dialog = readFileSync(new URL("../components/leaderboard-dialog.tsx", import.meta.url), "utf8");
  const modes = readFileSync(new URL("../lib/leaderboard.ts", import.meta.url), "utf8");

  assert.match(sql, /function public\.list_friend_leaderboard\(board text\)/);
  assert.match(sql, /board not in \('all_time', 'month', 'week', 'pet_levels'\)/);
  assert.match(sql, /status in \('submitted', 'cancelled'\)/);
  assert.match(sql, /sum\(study_sessions\.duration_seconds\)/);
  assert.match(sql, /board = 'month' and study_sessions\.ended_at >= month_start/);
  assert.match(sql, /board = 'week' and study_sessions\.ended_at >= week_start/);
  assert.match(sql, /Asia\/Hong_Kong/);
  assert.match(sql, /date_trunc\('week'/);
  assert.match(sql, /sum\(user_pets\.level\)/);
  assert.match(sql, /friendship\.status = 'accepted'/);
  assert.match(sql, /grant execute on function public\.list_friend_leaderboard\(text\) to authenticated/);

  assert.match(modes, /Cumulative study time between friends/);
  assert.match(modes, /Study time this month between friends/);
  assert.match(modes, /Study time this week between friends/);
  assert.match(modes, /Total levels of pets owned between friends/);
  assert.match(dialog, /leaderboard-grid/);
  assert.match(dialog, /loadFriendLeaderboard\(mode\)/);
});
