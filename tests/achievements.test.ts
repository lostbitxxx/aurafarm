import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ACHIEVEMENTS, earnedAchievementIds } from "../lib/achievements";

test("earned ids keep known achievements only", () => {
  assert.equal(ACHIEVEMENTS.length, 10);
  assert.deepEqual(earnedAchievementIds(["true_colors", "nope", 1, "hats_all"]), [
    "true_colors",
    "hats_all",
  ]);
  assert.deepEqual(
    ACHIEVEMENTS.map((achievement) => achievement.id),
    [
      "true_colors",
      "hats_all",
      "wardrobe",
      "week_of_wisdom",
      "thirty_days",
      "top_20",
      "on_your_left",
      "blend_in",
      "new_friend",
      "study_buddies",
    ],
  );
});

test("achievements are stored, granted from current progress, and cleared by admin reset", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0038_achievements.sql", import.meta.url),
    "utf8",
  );
  const dialog = readFileSync(new URL("../components/dashboard-dialogs.tsx", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("../lib/achievements.ts", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../lib/dashboard.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/admin-reset.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(sql, /create table if not exists public\.user_achievements/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /revoke all on function public\.grant_achievement\(uuid, text\) from public, anon, authenticated/);
  assert.match(sql, /drop function if exists public\.grant_achievement\(uuid, text\)/);
  assert.match(sql, /grant_achievement\(farmer uuid, target_achievement text\)/);
  assert.match(sql, /values \(farmer, target_achievement\)/);
  assert.match(sql, /grant execute on function public\.evaluate_achievements\(\) to authenticated/);

  const evaluate = sql.slice(
    sql.indexOf("function public.evaluate_achievements"),
    sql.indexOf("function public.send_friend_request"),
  );
  assert.match(evaluate, /kind = 'color'/);
  assert.match(evaluate, /'true_colors'/);
  assert.match(evaluate, /kind = 'hat'/);
  assert.match(evaluate, /'hats_all'/);
  assert.match(evaluate, /kind = 'clothes'/);
  assert.match(evaluate, /'wardrobe'/);
  assert.match(evaluate, /streak >= 7/);
  assert.match(evaluate, /'week_of_wisdom'/);
  assert.match(evaluate, /streak >= 30/);
  assert.match(evaluate, /'thirty_days'/);
  assert.match(evaluate, /status in \('submitted', 'cancelled'\)/);
  assert.match(evaluate, /my_score > 0 and my_place <= 20/);
  assert.match(evaluate, /'top_20'/);
  assert.match(evaluate, /friendship\.status = 'accepted'/);
  assert.match(evaluate, /'on_your_left'/);
  assert.match(evaluate, /hat = 'flower-day-daisy-clip'/);
  assert.match(evaluate, /clothes is null/);
  assert.match(evaluate, /'blend_in'/);
  assert.doesNotMatch(evaluate, /'new_friend'/);
  assert.doesNotMatch(evaluate, /'study_buddies'/);

  const send = sql.slice(
    sql.indexOf("function public.send_friend_request"),
    sql.indexOf("function public.accept_friend"),
  );
  assert.match(send, /'study_buddies'/);
  assert.match(send, /'new_friend'/);
  assert.match(send, /caller, 'pending', null/);

  const accept = sql.slice(
    sql.indexOf("function public.accept_friend"),
    sql.indexOf("select distinct friendship.user_a, 'new_friend'"),
  );
  assert.match(accept, /'new_friend'/);
  assert.doesNotMatch(accept, /'study_buddies'/);

  assert.match(sql, /where friendship\.status = 'accepted'/);
  assert.match(sql, /select distinct friendship\.requested_by, 'study_buddies'/);

  const reset = sql.slice(sql.indexOf("function public.reset_study_world"));
  assert.match(reset, /farmer := auth\.uid\(\)/);
  assert.match(reset, /streak_count = 0/);
  assert.ok(reset.indexOf("streak_count = 0") < reset.indexOf("delete from public.user_achievements"));
  assert.match(reset, /delete from public\.user_achievements\s+where user_id = farmer/);
  assert.doesNotMatch(reset, /delete from public\.user_achievements;/);
  assert.doesNotMatch(reset, /delete from public\.profiles/);

  assert.match(dashboard, /evaluate_achievements/);
  assert.match(dashboard, /user_achievements/);
  assert.match(screen, /earnedIds=\{earnedAchievements\}/);
  assert.match(dialog, /achievement-row-earned/);
  assert.match(dialog, /achievement-row-locked/);
  assert.match(dialog, /ACHIEVEMENTS\.map/);
  assert.match(dialog, />Earned</);
  assert.doesNotMatch(dialog, /Coming soon!/);
  for (const achievement of ACHIEVEMENTS) {
    assert.match(catalog, new RegExp(achievement.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(catalog, new RegExp(achievement.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(styles, /\.achievement-row-earned/);
  assert.match(styles, /\.achievement-row-locked/);
  assert.match(panel, /marks achievements undone/);
  assert.match(panel, /achievements are gone/);
});
