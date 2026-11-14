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
  assert.equal(
    leaderboardMessage("Could not find the function public.list_global_leaderboard"),
    "Run migration 0037 before opening the global leaderboard.",
  );
  assert.equal(
    leaderboardMessage("Could not find the function public.list_farm_crew_leaderboard"),
    "Run migration 0041 before opening the FarmCrew leaderboard.",
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

  assert.match(modes, /Cumulative Study Duration - Total/);
  assert.match(modes, /Cumulative Study Duration - This Month/);
  assert.match(modes, /Cumulative Study Duration - This Week/);
  assert.match(modes, /Total Pet Levels/);
  assert.match(dialog, /board-picker/);
  assert.match(dialog, /aria-label="Leaderboard mode"/);
  assert.match(dialog, /leaderboard-grid/);
  assert.match(dialog, /scope === "global" \? loadGlobalLeaderboard\(mode\) : loadFriendLeaderboard\(mode\)/);
  assert.match(dialog, /aria-label="Leaderboard scope"/);
  assert.match(dialog, /LEADERBOARD_SCOPES\.map/);
  assert.match(modes, /label: "Friends"/);
  assert.match(modes, /label: "Global"/);

  const globalSql = readFileSync(
    new URL("../supabase/migrations/0037_global_leaderboard.sql", import.meta.url),
    "utf8",
  );
  assert.match(globalSql, /function public\.list_global_leaderboard\(board text\)/);
  const crewSql = readFileSync(
    new URL("../supabase/migrations/0041_farm_crew_leaderboard.sql", import.meta.url),
    "utf8",
  );
  assert.match(crewSql, /function public\.list_farm_crew_leaderboard\(target uuid, board text\)/);
  assert.match(crewSql, /farm_crew_member\.status = 'accepted'/);
  assert.match(crewSql, /rank\(\) over \(order by scored\.score desc\)/);
  assert.doesNotMatch(crewSql, /limit 20/);
  assert.match(globalSql, /board not in \('all_time', 'month', 'week', 'pet_levels'\)/);
  assert.match(globalSql, /status in \('submitted', 'cancelled'\)/);
  assert.match(globalSql, /sum\(study_sessions\.duration_seconds\)/);
  assert.match(globalSql, /board = 'month' and study_sessions\.ended_at >= month_start/);
  assert.match(globalSql, /board = 'week' and study_sessions\.ended_at >= week_start/);
  assert.match(globalSql, /Asia\/Hong_Kong/);
  assert.match(globalSql, /sum\(user_pets\.level\)/);
  assert.match(globalSql, /limit 20/);
  assert.match(globalSql, /grant execute on function public\.list_global_leaderboard\(text\) to authenticated/);
});
